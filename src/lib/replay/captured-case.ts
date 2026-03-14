import { MarketSource, MarketStreamStatus } from "@/lib/market-data/types";
import { MarketInput, MarketState } from "@/lib/mock-market-state";

import { WitnessCase } from "@/lib/replay/witness-cases";

export const CAPTURED_WITNESS_CASE_STORAGE_KEY =
  "pyth-guard.captured-witness-case";
const CAPTURED_WITNESS_CASE_ID = "captured-dossier";

type CapturedWitnessCaseOptions = {
  input: MarketInput;
  state: MarketState;
  source: MarketSource;
  status: MarketStreamStatus;
  intent: string;
  orderSize: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toTitle(intent: string, asset: string) {
  return `The Captured ${intent} on ${asset}`;
}

function toSubtitle(status: MarketStreamStatus, source: MarketSource) {
  if (status === "live") {
    return `Captured from ${source === "pyth-pro" ? "live Pyth Pro" : "live feed"} conditions.`;
  }

  if (status === "warming") {
    return "Captured while Guard was still calibrating its live baseline.";
  }

  return "Captured from the fallback scenario stream for courtroom replay.";
}

function toVerdict(state: MarketState) {
  if (state.riskLevel === "Safe") return "Admissible Execution";
  if (state.riskLevel === "Caution") return "Contested Entry";
  return "Execution Rejected";
}

function toCharge(intent: string, state: MarketState, orderSize: number) {
  if (state.riskLevel === "Safe") {
    return `Testing whether a ${formatCurrency(orderSize)} ${intent.toLowerCase()} was justified under clean market conditions.`;
  }

  if (state.riskLevel === "Caution") {
    return `Taking a ${formatCurrency(orderSize)} ${intent.toLowerCase()} while execution trust was already degrading.`;
  }

  return `Attempting a ${formatCurrency(orderSize)} ${intent.toLowerCase()} despite Guard signaling that the market should stand down.`;
}

function buildEvidenceSummary(state: MarketState) {
  const summary = state.evidence.slice(0, 3).map((item) => {
    return `${item.label} registered ${item.delta.toLowerCase()} and pushed the case ${item.trend === "damaging" ? "against" : "toward"} execution.`;
  });

  if (state.flags.length === 0) {
    summary.push("No major flags were raised, so the case hinges on whether the verdict was respected.");
  } else {
    summary.push(`Guard flagged ${state.flags.join(", ")}, which materially changed the execution posture.`);
  }

  return summary;
}

function buildTranscript(
  options: Pick<
    CapturedWitnessCaseOptions,
    "intent" | "orderSize" | "source" | "status"
  > & {
    state: MarketState;
  },
) {
  const guardCap = Math.round(
    options.orderSize * options.state.executionPolicy.maxSizeFraction,
  );
  const formattedOrderSize = formatCurrency(options.orderSize);
  const formattedGuardCap = formatCurrency(guardCap);

  return [
    {
      role: "Prosecutor" as const,
      text:
        options.state.flags.length > 0
          ? `The defendant asked for a ${formattedOrderSize} ${options.intent.toLowerCase()} while ${options.state.flags.join(" and ").toLowerCase()} were already on the record.`
          : `The defendant asked for a ${formattedOrderSize} ${options.intent.toLowerCase()} with no obvious red flags, so the court must judge whether the verdict was followed properly.`,
    },
    {
      role: "Defense" as const,
      text:
        options.state.riskLevel === "Safe"
          ? `Trust still printed ${options.state.trustScore}. A trader could argue that the market structure remained orderly enough to proceed.`
          : `The price may still have looked tradable, but the defense must explain why a deteriorating trust score did not invalidate the entry.`,
    },
    {
      role: "Guard" as const,
      text: `Pyth Guard recommended "${options.state.recommendation}" with ${options.state.executionPolicy.executionMode} mode and a size cap near ${formattedGuardCap}. Source status: ${options.status}.`,
    },
    {
      role: "Judge" as const,
      text:
        options.state.riskLevel === "Safe"
          ? `Verdict: conditionally admissible. The market quality evidence permitted execution, but only within Guard's documented policy envelope.`
          : options.state.riskLevel === "Caution"
            ? `Verdict: contested. Execution was not automatically disallowed, but Guard required more restraint than a normal dashboard would suggest.`
            : `Verdict: rejected. The market quality evidence did not support aggressive execution, regardless of what the price chart implied.`,
    },
  ];
}

export function buildCapturedWitnessCase({
  input,
  state,
  source,
  status,
  intent,
  orderSize,
}: CapturedWitnessCaseOptions): WitnessCase {
  return {
    id: CAPTURED_WITNESS_CASE_ID,
    title: toTitle(intent, state.asset),
    subtitle: toSubtitle(status, source),
    defendant: `${intent} ${state.asset} Ticket`,
    charge: toCharge(intent, state, orderSize),
    frame: input,
    timeline: state.timeline,
    verdict: toVerdict(state),
    recommendedAction: `${state.recommendation} with guard cap near ${formatCurrency(
      Math.round(orderSize * state.executionPolicy.maxSizeFraction),
    )}.`,
    evidenceSummary: buildEvidenceSummary(state),
    lines: buildTranscript({ intent, orderSize, source, status, state }),
    captureMeta: {
      source,
      status,
      intent,
      orderSize,
      capturedAtIso: new Date().toISOString(),
    },
  };
}

export function parseCapturedWitnessCase(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as WitnessCase;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.id !== CAPTURED_WITNESS_CASE_ID ||
      typeof parsed.title !== "string" ||
      !Array.isArray(parsed.timeline) ||
      !Array.isArray(parsed.evidenceSummary) ||
      !Array.isArray(parsed.lines)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
