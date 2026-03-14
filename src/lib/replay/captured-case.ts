import { MarketSource, MarketStreamStatus } from "@/lib/market-data/types";
import { MarketInput, MarketState } from "@/lib/mock-market-state";
import {
  formatCurrency,
  formatPrice,
  TradeAssessment,
} from "@/lib/trade-ticket";

import { WitnessCase } from "@/lib/replay/witness-cases";

const LEGACY_CAPTURED_WITNESS_CASE_STORAGE_KEY =
  "pyth-guard.captured-witness-case";
export const CAPTURED_WITNESS_DOCKET_STORAGE_KEY =
  "pyth-guard.captured-witness-docket";
const CAPTURED_WITNESS_CASE_ID_PREFIX = "captured-dossier";
const MAX_CAPTURED_WITNESS_CASES = 6;

type CapturedWitnessCaseOptions = {
  input: MarketInput;
  state: MarketState;
  source: MarketSource;
  status: MarketStreamStatus;
  intent: string;
  tradeAssessment: TradeAssessment;
};

function createCapturedCaseId() {
  return `${CAPTURED_WITNESS_CASE_ID_PREFIX}-${Date.now().toString(36)}`;
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

function toCharge(
  intent: string,
  asset: string,
  tradeAssessment: TradeAssessment,
) {
  if (intent === "Exit") {
    return `Testing whether closing ${formatCurrency(tradeAssessment.orderSize)} near ${formatPrice(
      tradeAssessment.entryPrice,
      asset,
    )} was discipline or overreaction.`;
  }

  if (tradeAssessment.riskLevel === "Safe") {
    return `Testing whether a ${formatCurrency(tradeAssessment.orderSize)} ${intent.toLowerCase()} deserved admission under clean market conditions.`;
  }

  if (tradeAssessment.riskLevel === "Caution") {
    return `Taking a ${formatCurrency(tradeAssessment.orderSize)} ${intent.toLowerCase()} while Guard demanded tighter execution terms.`;
  }

  return `Attempting a ${formatCurrency(tradeAssessment.orderSize)} ${intent.toLowerCase()} despite a sustained objection from Guard.`;
}

function buildEvidenceSummary(
  state: MarketState,
  tradeAssessment: TradeAssessment,
) {
  const summary = tradeAssessment.objections.slice(0, 3);

  if (summary.length < 3) {
    summary.push(
      ...state.evidence.slice(0, 3 - summary.length).map((item) => {
        return `${item.label} registered ${item.delta.toLowerCase()} and pushed the case ${item.trend === "damaging" ? "against" : "toward"} execution.`;
      }),
    );
  }

  if (state.flags.length > 0) {
    summary.push(
      `Guard also flagged ${state.flags.join(", ")}, which materially changed the execution posture.`,
    );
  }

  return summary;
}

export function buildCapturedWitnessCase({
  input,
  state,
  source,
  status,
  intent,
  tradeAssessment,
}: CapturedWitnessCaseOptions): WitnessCase {
  const capturedAtIso = new Date().toISOString();

  return {
    id: createCapturedCaseId(),
    title: toTitle(intent, state.asset),
    subtitle: toSubtitle(status, source),
    defendant: `${intent} ${state.asset} Ticket`,
    charge: toCharge(intent, state.asset, tradeAssessment),
    frame: input,
    timeline: state.timeline,
    verdict: tradeAssessment.verdict,
    recommendedAction: tradeAssessment.recommendedAction,
    evidenceSummary: buildEvidenceSummary(state, tradeAssessment),
    lines: tradeAssessment.lines,
    captureMeta: {
      source,
      status,
      intent,
      orderSize: tradeAssessment.orderSize,
      capturedAtIso,
      entryPrice: tradeAssessment.entryPrice,
      ticketScore: tradeAssessment.score,
      ticketVerdict: tradeAssessment.verdict,
    },
  };
}

function isValidWitnessCase(value: unknown): value is WitnessCase {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as WitnessCase;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.subtitle === "string" &&
    typeof candidate.defendant === "string" &&
    typeof candidate.charge === "string" &&
    typeof candidate.verdict === "string" &&
    typeof candidate.recommendedAction === "string" &&
    Array.isArray(candidate.timeline) &&
    Array.isArray(candidate.evidenceSummary) &&
    Array.isArray(candidate.lines)
  );
}

function parseCapturedWitnessCase(raw: string | null) {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return isValidWitnessCase(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseCapturedWitnessDocket(raw: string | null) {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidWitnessCase).slice(0, MAX_CAPTURED_WITNESS_CASES);
  } catch {
    return [];
  }
}

export function readCapturedWitnessCases(storage: Storage) {
  const docket = parseCapturedWitnessDocket(
    storage.getItem(CAPTURED_WITNESS_DOCKET_STORAGE_KEY),
  );

  if (docket.length > 0) {
    return docket;
  }

  const legacyCase = parseCapturedWitnessCase(
    storage.getItem(LEGACY_CAPTURED_WITNESS_CASE_STORAGE_KEY),
  );

  return legacyCase ? [legacyCase] : [];
}

export function storeCapturedWitnessCase(
  storage: Storage,
  capturedCase: WitnessCase,
) {
  const nextDocket = [
    capturedCase,
    ...readCapturedWitnessCases(storage).filter((item) => item.id !== capturedCase.id),
  ].slice(0, MAX_CAPTURED_WITNESS_CASES);

  storage.setItem(
    CAPTURED_WITNESS_DOCKET_STORAGE_KEY,
    JSON.stringify(nextDocket),
  );
  storage.removeItem(LEGACY_CAPTURED_WITNESS_CASE_STORAGE_KEY);

  return nextDocket;
}

export function clearCapturedWitnessCases(storage: Storage) {
  storage.removeItem(CAPTURED_WITNESS_DOCKET_STORAGE_KEY);
  storage.removeItem(LEGACY_CAPTURED_WITNESS_CASE_STORAGE_KEY);
}
