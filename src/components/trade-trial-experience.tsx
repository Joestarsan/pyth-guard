"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { PythBrand } from "@/components/pyth-brand";
import { useMarketStream } from "@/hooks/use-market-stream";
import {
  EvidenceItem,
  EvidenceTrend,
  MarketInput,
  MarketState,
  supportedAssets,
  SupportedAsset,
} from "@/lib/mock-market-state";
import { apiMarketProvider } from "@/lib/market-data/api-provider";
import {
  assessTradeTicket,
  formatCurrency,
  formatPrice,
  getDefaultEntryPrice,
  TradeIntent,
} from "@/lib/trade-ticket";

const caseSides = ["Long", "Short", "Exit"] as const satisfies readonly TradeIntent[];
const courtroomRoles = ["Defense", "Judge", "Prosecutor"] as const;

type TrialPhase = "intake" | "opening" | "trial" | "renderVerdict" | "verdict";
type CourtRole = (typeof courtroomRoles)[number];
type TrialTone = "attack" | "defense" | "warning" | "verdict";
type CourtroomCue = TrialTone | "opening" | "victory" | "defeat" | "gavel";
type PortraitExpression = "idle" | "speaking" | "emphasis" | "shocked" | "stoic" | "gavel";

type TrialProofCard = {
  id: string;
  label: string;
  value: string;
  delta: string;
  note: string;
  source: string;
  trend: EvidenceTrend;
  emphasis: string;
};

type TrialBeat = {
  id: string;
  speaker: CourtRole;
  tone: TrialTone;
  cue: string;
  headline: string;
  speech: string;
  proofs: TrialProofCard[];
};

type VerdictBoard = {
  outcome: "Acquitted" | "Contested" | "Convicted";
  stamp: string;
  summary: string;
  reasons: string[];
  guidance: string;
  winner: "Defense" | "Prosecutor";
};

type TrialRun = {
  enteredAtLabel: string;
  beats: TrialBeat[];
  verdict: VerdictBoard;
  dossier: TrialProofCard[];
};

type TrialLeg = {
  asset: string;
  enteredAtLabel: string;
  sourceLabel: string;
  sourceNotice?: string;
  tradeAssessment: ReturnType<typeof assessTradeTicket>;
  state: MarketState;
};

type MarketRecordPayload = {
  input: MarketInput;
  state: MarketState;
  source: "pyth-pro" | "mock";
  status: "live" | "warming" | "fallback";
  notice?: string;
  baselineSamples?: number;
  baselineTarget?: number;
  sampledAtMs: number;
};

const rolePortraits: Record<CourtRole, string> = {
  Defense: "/courtroom/defense.png",
  Judge: "/courtroom/judge.png",
  Prosecutor: "/courtroom/prosecutor.png",
};

function outcomeWeight(outcome: VerdictBoard["outcome"]) {
  if (outcome === "Acquitted") return 1;
  if (outcome === "Convicted") return -1;
  return 0;
}

function currentPositionWeight(outcome: VerdictBoard["outcome"]) {
  if (outcome === "Convicted") return 1;
  if (outcome === "Acquitted") return -1;
  return 0;
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatEnteredAt(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Unknown filing time";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

let sharedCourtAudioContext: AudioContext | null = null;

function getCourtAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) return null;

  if (!sharedCourtAudioContext || sharedCourtAudioContext.state === "closed") {
    sharedCourtAudioContext = new AudioContextCtor();
  }

  if (sharedCourtAudioContext.state === "suspended") {
    void sharedCourtAudioContext.resume();
  }

  return sharedCourtAudioContext;
}

function playCourtroomCue(kind: CourtroomCue) {
  const audioContext = getCourtAudioContext();
  if (!audioContext) return;

  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.14, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.66);

  const lead = audioContext.createOscillator();
  const accent = audioContext.createOscillator();

  if (kind === "attack") {
    lead.type = "square";
    lead.frequency.setValueAtTime(164, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(118, audioContext.currentTime + 0.18);
    accent.type = "triangle";
    accent.frequency.setValueAtTime(760, audioContext.currentTime + 0.03);
    accent.frequency.exponentialRampToValueAtTime(320, audioContext.currentTime + 0.24);
  } else if (kind === "defense") {
    lead.type = "triangle";
    lead.frequency.setValueAtTime(240, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(380, audioContext.currentTime + 0.2);
    accent.type = "sine";
    accent.frequency.setValueAtTime(420, audioContext.currentTime + 0.02);
    accent.frequency.exponentialRampToValueAtTime(680, audioContext.currentTime + 0.22);
  } else if (kind === "warning") {
    lead.type = "sawtooth";
    lead.frequency.setValueAtTime(132, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(198, audioContext.currentTime + 0.16);
    accent.type = "square";
    accent.frequency.setValueAtTime(284, audioContext.currentTime + 0.04);
    accent.frequency.exponentialRampToValueAtTime(190, audioContext.currentTime + 0.26);
  } else if (kind === "opening") {
    lead.type = "square";
    lead.frequency.setValueAtTime(186, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(246, audioContext.currentTime + 0.18);
    accent.type = "triangle";
    accent.frequency.setValueAtTime(420, audioContext.currentTime + 0.04);
    accent.frequency.exponentialRampToValueAtTime(560, audioContext.currentTime + 0.24);
  } else if (kind === "victory") {
    lead.type = "square";
    lead.frequency.setValueAtTime(262, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(392, audioContext.currentTime + 0.18);
    accent.type = "triangle";
    accent.frequency.setValueAtTime(523, audioContext.currentTime + 0.06);
    accent.frequency.exponentialRampToValueAtTime(784, audioContext.currentTime + 0.28);
  } else if (kind === "defeat") {
    lead.type = "sawtooth";
    lead.frequency.setValueAtTime(220, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(132, audioContext.currentTime + 0.22);
    accent.type = "square";
    accent.frequency.setValueAtTime(320, audioContext.currentTime + 0.05);
    accent.frequency.exponentialRampToValueAtTime(156, audioContext.currentTime + 0.26);
  } else if (kind === "gavel") {
    lead.type = "square";
    lead.frequency.setValueAtTime(118, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(84, audioContext.currentTime + 0.12);
    accent.type = "triangle";
    accent.frequency.setValueAtTime(860, audioContext.currentTime + 0.01);
    accent.frequency.exponentialRampToValueAtTime(240, audioContext.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
  } else {
    lead.type = "square";
    lead.frequency.setValueAtTime(236, audioContext.currentTime);
    lead.frequency.exponentialRampToValueAtTime(480, audioContext.currentTime + 0.24);
    accent.type = "triangle";
    accent.frequency.setValueAtTime(640, audioContext.currentTime + 0.05);
    accent.frequency.exponentialRampToValueAtTime(820, audioContext.currentTime + 0.28);
  }

  lead.connect(gain);
  accent.connect(gain);
  lead.start(audioContext.currentTime);
  lead.stop(audioContext.currentTime + (kind === "gavel" ? 0.14 : 0.36));
  accent.start(audioContext.currentTime + 0.02);
  accent.stop(audioContext.currentTime + (kind === "gavel" ? 0.12 : 0.34));
}

function playDialogueBlip(role: CourtRole) {
  const audioContext = getCourtAudioContext();
  if (!audioContext) return;

  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.03, audioContext.currentTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.06);

  const oscillator = audioContext.createOscillator();
  oscillator.connect(gain);
  oscillator.type =
    role === "Defense" ? "triangle" : role === "Prosecutor" ? "square" : "sine";
  const baseFrequency =
    role === "Defense" ? 520 : role === "Prosecutor" ? 420 : 340;
  oscillator.frequency.setValueAtTime(baseFrequency, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(
    baseFrequency * 0.92,
    audioContext.currentTime + 0.045,
  );
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
}

function buildProofCard(args: {
  prefix: string;
  label: string;
  value: string;
  delta: string;
  note: string;
  source: string;
  trend: EvidenceTrend;
  emphasis: string;
}) {
  return {
    id: `${sanitizeId(args.prefix)}-${sanitizeId(args.label)}`,
    label: args.label,
    value: args.value,
    delta: args.delta,
    note: args.note,
    source: args.source,
    trend: args.trend,
    emphasis: args.emphasis,
  } satisfies TrialProofCard;
}

function buildProofFromEvidence(args: {
  prefix: string;
  item: EvidenceItem;
  source: string;
  emphasis: string;
}) {
  return buildProofCard({
    prefix: args.prefix,
    label: args.item.label,
    value: args.item.value,
    delta: args.item.delta,
    note: args.item.note,
    source: args.source,
    trend: args.item.trend,
    emphasis: args.emphasis,
  });
}

function buildVerdictBoard(args: {
  asset: string;
  intent: TradeIntent;
  enteredAtLabel: string;
  tradeAssessment: ReturnType<typeof assessTradeTicket>;
}) {
  const { asset, intent, enteredAtLabel, tradeAssessment } = args;

  if (intent === "Exit") {
    if (tradeAssessment.score >= 78) {
      return {
        outcome: "Convicted",
        stamp: "EARLY EXIT",
        summary: `${asset} exit filed for ${enteredAtLabel} does not survive scrutiny. The tape stayed orderly enough that the close was optional, not compelled.`,
        reasons: [
          "The market structure stayed coherent enough that closing was not structurally required.",
          tradeAssessment.recommendedAction,
          "The prosecution proved this exit was precautionary at best and premature at worst.",
        ],
        guidance: "Verdict: likely closed too early. Let the market deteriorate first before calling it protective.",
        winner: "Prosecutor",
      } as const satisfies VerdictBoard;
    }

    if (tradeAssessment.score >= 55) {
      return {
        outcome: "Contested",
        stamp: "DEBATABLE EXIT",
        summary: `${asset} exit filed for ${enteredAtLabel} is arguable. The tape softened enough to justify caution, but the court cannot call the close strictly necessary.`,
        reasons: [
          tradeAssessment.objections[0] ?? "The prosecution argued the close came before the tape truly broke.",
          `The exit landed ${tradeAssessment.score} on necessity, which makes it understandable but not mandatory.`,
          tradeAssessment.recommendedAction,
        ],
        guidance: "Verdict: understandable close, but not a slam-dunk rescue. The trader may have left a bit early.",
        winner: "Prosecutor",
      } as const satisfies VerdictBoard;
    }

    return {
      outcome: "Acquitted",
      stamp: "JUSTIFIED EXIT",
      summary: `${asset} exit filed for ${enteredAtLabel} is justified. The market degraded enough that closing risk was the defensible move.`,
      reasons: [
        "The feed deteriorated enough to support de-risking instead of fresh exposure.",
        tradeAssessment.recommendedAction,
        "The defense proved this was protection, not panic.",
      ],
      guidance: "Verdict: good de-risk. The exit respected the tape before conditions got worse.",
      winner: "Defense",
    } as const satisfies VerdictBoard;
  }

  if (tradeAssessment.score >= 78) {
    return {
      outcome: "Acquitted",
      stamp: "NOT GUILTY",
      summary: `${asset} ${intent.toLowerCase()} filed for ${enteredAtLabel} survives the objection. The defense proved the tape was clean enough for admission.`,
      reasons: [
        "The live market structure stayed coherent enough to support the requested side.",
        `The filing remained inside the Guard envelope near ${formatCurrency(
          tradeAssessment.guardCap,
        )}.`,
        tradeAssessment.recommendedAction,
      ],
      guidance: "Verdict: disciplined trade. Keep reading the tape before pressing for even more size.",
      winner: "Defense",
    } as const satisfies VerdictBoard;
  }

  if (tradeAssessment.score >= 55) {
    return {
      outcome: "Contested",
      stamp: "SPLIT DECISION",
      summary: `${asset} ${intent.toLowerCase()} filed for ${enteredAtLabel} was not absurd, but the prosecution proved the trader asked too much from this tape.`,
      reasons: [
        tradeAssessment.objections[0] ?? "The prosecution raised a material objection.",
        `Ticket admissibility landed at ${tradeAssessment.score}, so the court allows only a tighter and cleaner version of the same idea.`,
        tradeAssessment.recommendedAction,
      ],
      guidance: "Verdict: market was tradable, your ticket was not clean enough. Analyze the structure before sizing up.",
      winner: "Prosecutor",
    } as const satisfies VerdictBoard;
  }

  return {
    outcome: "Convicted",
    stamp: "GUILTY",
    summary: `${asset} ${intent.toLowerCase()} filed for ${enteredAtLabel} failed the execution-quality test. The objection is sustained.`,
    reasons: [
      tradeAssessment.objections[0] ?? "The live tape objected to the trade.",
      tradeAssessment.objections[1] ??
        `${tradeAssessment.leverage}x leverage and degraded execution quality combined into an unsafe filing.`,
      tradeAssessment.recommendedAction,
    ],
    guidance: "Verdict: guilty of forcing a weak tape. Analyze the market better before reopening risk.",
    winner: "Prosecutor",
  } as const satisfies VerdictBoard;
}

function buildDossier(args: {
  asset: string;
  enteredAtLabel: string;
  sourceLabel: string;
  sourceNotice?: string;
  tradeAssessment: ReturnType<typeof assessTradeTicket>;
  state: ReturnType<typeof assessTradeTicket> extends never ? never : {
    trustScore: number;
    riskLevel: string;
    narrative: string;
    recommendation: string;
    evidence: EvidenceItem[];
  };
}) {
  const { asset, enteredAtLabel, sourceLabel, sourceNotice, tradeAssessment, state } =
    args;

  const staticCards = [
    buildProofCard({
      prefix: "dossier",
      label: "Filed Trade",
      value: `${asset} ${tradeAssessment.intent}`,
      delta: enteredAtLabel,
      note: "The court reconstructs the case from the trader's submitted pair, action, time, size, leverage, and filed price.",
      source: "Case Intake",
      trend: "neutral",
      emphasis: "This is the filing that went on trial.",
    }),
    buildProofCard({
      prefix: "dossier",
      label: "Ticket Score",
      value: `${tradeAssessment.score}`,
      delta: tradeAssessment.verdict,
      note: tradeAssessment.summary,
      source: "Ticket Reconstruction",
      trend:
        tradeAssessment.score >= 78
          ? "supporting"
          : tradeAssessment.score >= 55
            ? "neutral"
            : "damaging",
      emphasis: "This is the admissibility score for the exact requested ticket.",
    }),
    buildProofCard({
      prefix: "dossier",
      label: "Market Trust",
      value: `${state.trustScore}`,
      delta: state.riskLevel,
      note: state.narrative,
      source: sourceLabel,
      trend:
        state.riskLevel === "Safe"
          ? "supporting"
          : state.riskLevel === "Caution"
            ? "neutral"
            : "damaging",
      emphasis:
        sourceNotice ?? "Derived from confidence, spread, publishers, session, and freshness.",
    }),
    buildProofCard({
      prefix: "dossier",
      label: "Recommended Action",
      value: state.recommendation,
      delta: tradeAssessment.recommendedAction,
      note: "The court separates raw market quality from the actual ticket you tried to file.",
      source: "Guard Policy",
      trend:
        tradeAssessment.score >= 78
          ? "supporting"
          : tradeAssessment.score >= 55
            ? "neutral"
            : "damaging",
      emphasis: "This is the practical instruction after the ruling.",
    }),
  ];

  return [
    ...staticCards,
    ...tradeAssessment.evidence.map((item, index) =>
      buildProofFromEvidence({
        prefix: `ticket-${index}`,
        item,
        source: "Ticket Reconstruction",
        emphasis: "This proof targets the trader's exact requested execution.",
      }),
    ),
    ...state.evidence.map((item, index) =>
      buildProofFromEvidence({
        prefix: `market-${index}`,
        item,
        source: sourceLabel,
        emphasis: "This proof comes directly from the live Pyth market record.",
      }),
    ),
  ];
}

function buildTrialBeats(args: {
  asset: string;
  enteredAtLabel: string;
  sourceLabel: string;
  contextLabel: string;
  sourceNotice?: string;
  tradeAssessment: ReturnType<typeof assessTradeTicket>;
  state: {
    trustScore: number;
    riskLevel: string;
    narrative: string;
    recommendation: string;
    evidence: EvidenceItem[];
  };
}) {
  const {
    asset,
    enteredAtLabel,
    sourceLabel,
    contextLabel,
    sourceNotice,
    tradeAssessment,
    state,
  } = args;

  const damagingTicket =
    tradeAssessment.evidence.find((item) => item.trend === "damaging") ??
    tradeAssessment.evidence[0];
  const supportingTicket =
    tradeAssessment.evidence.find((item) => item.trend === "supporting") ??
    tradeAssessment.evidence.find((item) => item.trend === "neutral") ??
    tradeAssessment.evidence[0];
  const damagingMarket =
    state.evidence.find((item) => item.trend === "damaging") ?? state.evidence[0];
  const supportingMarket =
    state.evidence.find((item) => item.trend === "supporting") ??
    state.evidence.find((item) => item.trend === "neutral") ??
    state.evidence[0];
  const secondDamagingMarket =
    state.evidence.filter((item) => item.trend === "damaging")[1] ??
    state.evidence.find((item) => item.label === "Feed Freshness") ??
    state.evidence[1] ??
    damagingMarket;
  const leverageEvidence =
    tradeAssessment.evidence.find((item) => item.label === "Leverage") ??
    tradeAssessment.evidence[0];
  const priceEvidence =
    tradeAssessment.evidence.find((item) => item.label === "Entry Price") ??
    tradeAssessment.evidence[1] ??
    tradeAssessment.evidence[0];
  const sizeEvidence =
    tradeAssessment.evidence.find((item) => item.label === "Size Discipline") ??
    tradeAssessment.evidence[2] ??
    tradeAssessment.evidence[0];
  const trustCard = buildProofCard({
    prefix: "beat",
    label: "Market Trust",
    value: `${state.trustScore}`,
    delta: state.riskLevel,
    note: state.narrative,
    source: sourceLabel,
    trend:
      state.riskLevel === "Safe"
        ? "supporting"
        : state.riskLevel === "Caution"
          ? "neutral"
          : "damaging",
    emphasis: contextLabel,
  });
  const capCard = buildProofCard({
    prefix: "beat",
    label: "Guard Cap",
    value: formatCurrency(tradeAssessment.guardCap),
    delta: `${Math.round(tradeAssessment.sizeRatio * 100)}% requested`,
    note: "The court compares your size request to the live policy envelope, not to your own confidence.",
    source: "Guard Policy",
    trend: tradeAssessment.sizeRatio > 1 ? "damaging" : "supporting",
    emphasis: "This is the maximum size the live tape can reasonably defend.",
  });
  const sourceCard = buildProofCard({
    prefix: "beat",
    label: "Evidence Source",
    value: sourceLabel,
    delta: enteredAtLabel,
    note: sourceNotice ?? "The market record is updated live when Pyth Pro is available and falls back only if entitlements are missing.",
    source: "Pyth Feed",
    trend: sourceLabel.includes("Fallback") ? "neutral" : "supporting",
    emphasis: "These proofs are tied to the live or warmed-up feed state.",
  });

  if (tradeAssessment.intent === "Exit") {
    return [
      {
        id: "prosecutor-opening",
        speaker: "Prosecutor",
        tone: "attack",
        cue: "Objection!",
        headline: "This close may be early.",
        speech:
          tradeAssessment.score >= 78
            ? `The prosecution submits that this ${asset} exit was filed before the tape demanded it. Market trust still printed ${state.trustScore}, so the trader may have bailed too early.`
            : tradeAssessment.score >= 55
              ? `The prosecution argues this ${asset} exit was understandable, but not fully compelled. The tape softened, yet never fully collapsed.`
              : `The prosecution raises the objection only to test the close. If the defense proves the tape was breaking, this exit may still be justified.`,
        proofs: [
          trustCard,
          buildProofFromEvidence({
            prefix: "exit-prosecutor-opening",
            item: damagingMarket,
            source: sourceLabel,
            emphasis: "This is the prosecution's best case against the timing of the close.",
          }),
          buildProofFromEvidence({
            prefix: "exit-prosecutor-opening",
            item: priceEvidence,
            source: "Ticket Reconstruction",
            emphasis: "Exit pricing still matters when judging whether the trader rushed the close.",
          }),
        ],
      },
      {
        id: "defense-answer",
        speaker: "Defense",
        tone: "defense",
        cue: "Hold It!",
        headline: "Closing can be protection, not panic.",
        speech:
          tradeAssessment.score >= 78
            ? `The defense admits the tape was not collapsing, but argues caution is not a crime. ${supportingMarket.label} still left room for a prudent close.`
            : tradeAssessment.score >= 55
              ? `The defense responds that ${supportingMarket.label.toLowerCase()} already showed strain at ${supportingMarket.value}. This was not a random panic click.`
              : `The defense points straight to the feed: ${supportingMarket.label} printed ${supportingMarket.value}, ${supportingMarket.delta.toLowerCase()}, so the trader was right to flatten risk.`,
        proofs: [
          buildProofFromEvidence({
            prefix: "exit-defense-answer",
            item: supportingMarket,
            source: sourceLabel,
            emphasis: "This is the defense's best proof that de-risking made sense.",
          }),
          buildProofFromEvidence({
            prefix: "exit-defense-answer",
            item: supportingTicket,
            source: "Ticket Reconstruction",
            emphasis: "This shows how the close fit the actual ticket.",
          }),
          sourceCard,
        ],
      },
      {
        id: "prosecutor-rebuttal",
        speaker: "Prosecutor",
        tone: "attack",
        cue: "Take That!",
        headline: "The record still matters.",
        speech:
          tradeAssessment.score >= 78
            ? `${sourceLabel} never fully broke. ${damagingMarket.label} was only ${damagingMarket.value}, ${damagingMarket.delta.toLowerCase()}, and the close remained optional.`
            : tradeAssessment.score >= 55
              ? `The prosecution counters that the tape was weakening, but not yet broken enough to make this the only reasonable move.`
              : `The prosecution's case collapses under the feed. Too many structural warnings arrived together for the court to call this exit premature.`,
        proofs: [
          buildProofFromEvidence({
            prefix: "exit-prosecutor-rebuttal",
            item: damagingTicket,
            source: "Ticket Reconstruction",
            emphasis: "This proof tests whether the close timing was actually forced.",
          }),
          buildProofFromEvidence({
            prefix: "exit-prosecutor-rebuttal",
            item: secondDamagingMarket,
            source: sourceLabel,
            emphasis: "A second proof checks whether the market really demanded the close.",
          }),
          capCard,
        ],
      },
      {
        id: "defense-close",
        speaker: "Defense",
        tone: "defense",
        cue: "Not So Fast!",
        headline: "The trader only needed one valid reason.",
        speech:
          tradeAssessment.score >= 78
            ? `The defense can only argue discretion. ${tradeAssessment.recommendedAction}`
            : tradeAssessment.score >= 55
              ? `The defense rests on caution. ${tradeAssessment.recommendedAction}`
              : `The defense rests on necessity. ${tradeAssessment.recommendedAction}`,
        proofs: [
          buildProofFromEvidence({
            prefix: "exit-defense-close",
            item: sizeEvidence,
            source: "Ticket Reconstruction",
            emphasis: "This frames the consequences of staying in risk longer.",
          }),
          buildProofFromEvidence({
            prefix: "exit-defense-close",
            item: leverageEvidence,
            source: "Ticket Reconstruction",
            emphasis: "Existing leverage changes how fast a soft tape can become dangerous.",
          }),
          sourceCard,
        ],
      },
      {
        id: "judge-warning",
        speaker: "Judge",
        tone: "warning",
        cue: "Order!",
        headline: "The exit record is complete.",
        speech:
          "The court has heard enough. Pyth evidence, ticket context, and the timing of the close are now on record. Press the next key and the court will decide whether the trader exited too early or exactly on time.",
        proofs: [trustCard, capCard, sourceCard],
      },
    ] as const satisfies TrialBeat[];
  }

  return [
    {
      id: "prosecutor-opening",
      speaker: "Prosecutor",
      tone: "attack",
      cue: "Objection!",
      headline: "Unsafe filing submitted.",
      speech:
        tradeAssessment.objections[0] ??
        `The prosecution submits that this ${tradeAssessment.intent.toLowerCase()} on ${asset} was filed into a tape that never gave permission for it.`,
      proofs: [
        trustCard,
        buildProofFromEvidence({
          prefix: "prosecutor-opening",
          item: damagingTicket,
          source: "Ticket Reconstruction",
          emphasis: "This proof supports the prosecution.",
        }),
        buildProofFromEvidence({
          prefix: "prosecutor-opening",
          item: damagingMarket,
          source: sourceLabel,
          emphasis: "This proof comes from Pyth market structure.",
        }),
      ],
    },
    {
      id: "defense-answer",
      speaker: "Defense",
      tone: "defense",
      cue: "Hold It!",
      headline: "The tape was not pure chaos.",
      speech:
        tradeAssessment.score >= 78
          ? `The defense objects. ${supportingTicket.label} still printed ${supportingTicket.value}, ${supportingTicket.delta.toLowerCase()}, so the trader had a defensible window.`
          : tradeAssessment.score >= 55
            ? `The defense concedes the ticket was aggressive, but ${supportingMarket.label.toLowerCase()} remained ${supportingMarket.value}. This case deserved a smaller remedy, not panic.`
            : `The defense asks for mitigation only. ${supportingMarket.label} still printed ${supportingMarket.value}, which means the tape was weak, not completely dead.`,
      proofs: [
        buildProofFromEvidence({
          prefix: "defense-answer",
          item: supportingTicket,
          source: "Ticket Reconstruction",
          emphasis: "This proof supports the defense.",
        }),
        buildProofFromEvidence({
          prefix: "defense-answer",
          item: supportingMarket,
          source: sourceLabel,
          emphasis: "This proof shows where the tape still held together.",
        }),
        capCard,
      ],
    },
    {
      id: "prosecutor-rebuttal",
      speaker: "Prosecutor",
      tone: "attack",
      cue: "Take That!",
      headline: "Pyth Pro says otherwise.",
      speech:
        tradeAssessment.objections[1] ??
        `${sourceLabel} reconstructs the market like this: ${damagingMarket.label} hit ${damagingMarket.value}, ${damagingMarket.delta.toLowerCase()}, and ${secondDamagingMarket.label.toLowerCase()} did not rescue the tape.`,
      proofs: [
        buildProofFromEvidence({
          prefix: "prosecutor-rebuttal",
          item: damagingMarket,
          source: sourceLabel,
          emphasis: "Live market structure turned against the trade.",
        }),
        buildProofFromEvidence({
          prefix: "prosecutor-rebuttal",
          item: secondDamagingMarket,
          source: sourceLabel,
          emphasis: "A second market proof confirms the objection.",
        }),
        buildProofFromEvidence({
          prefix: "prosecutor-rebuttal",
          item: leverageEvidence,
          source: "Ticket Reconstruction",
          emphasis: "The ticket amplified the market weakness instead of respecting it.",
        }),
      ],
    },
    {
      id: "defense-close",
      speaker: "Defense",
      tone: "defense",
      cue: "Not So Fast!",
      headline: "Context still matters.",
      speech:
        tradeAssessment.score >= 78
          ? `The defense rests on discipline. ${tradeAssessment.recommendedAction}`
          : tradeAssessment.score >= 55
            ? `The defense accepts the warning, but the proper remedy is narrower execution: ${tradeAssessment.recommendedAction}`
            : `The defense cannot ask for acquittal, only mercy. ${tradeAssessment.recommendedAction}`,
      proofs: [
        buildProofFromEvidence({
          prefix: "defense-close",
          item: sizeEvidence,
          source: "Ticket Reconstruction",
          emphasis: "This proof frames the exact discipline problem or discipline win.",
        }),
        buildProofFromEvidence({
          prefix: "defense-close",
          item: priceEvidence,
          source: "Ticket Reconstruction",
          emphasis: "Entry quality still matters even when the market thesis is arguable.",
        }),
        sourceCard,
      ],
    },
    {
      id: "judge-warning",
      speaker: "Judge",
      tone: "warning",
      cue: "Order!",
      headline: "The record is complete.",
      speech:
        "The court has heard enough. Pyth evidence, ticket reconstruction, and the conduct of the filing are now on record. Press the next key and the court will render its verdict.",
      proofs: [
        trustCard,
        capCard,
        sourceCard,
      ],
    },
  ] as const satisfies TrialBeat[];
}

function buildCaseBeats(
  leg: TrialLeg,
  sectionKey: string,
  sectionLabel: string,
) {
  return buildTrialBeats({
    asset: leg.asset,
    enteredAtLabel: leg.enteredAtLabel,
    sourceLabel: leg.sourceLabel,
    contextLabel: `${sectionLabel} record.`,
    sourceNotice: leg.sourceNotice,
    tradeAssessment: leg.tradeAssessment,
    state: leg.state,
  })
    .filter((beat) => beat.speaker !== "Judge")
    .map((beat) => ({
      ...beat,
      id: `${sectionKey}-${beat.id}`,
      headline: `${sectionLabel}: ${beat.headline}`,
      proofs: beat.proofs.map((proof) => ({
        ...proof,
        id: `${sectionKey}-${proof.id}`,
      })),
    }));
}

function buildCaseDossier(
  leg: TrialLeg,
  sectionKey: string,
  sectionLabel: string,
) {
  return buildDossier({
    asset: leg.asset,
    enteredAtLabel: leg.enteredAtLabel,
    sourceLabel: leg.sourceLabel,
    sourceNotice: leg.sourceNotice,
    tradeAssessment: leg.tradeAssessment,
    state: leg.state,
  }).map((proof) => ({
    ...proof,
    id: `${sectionKey}-${proof.id}`,
    label: `${sectionLabel} ${proof.label}`,
  }));
}

function buildCombinedVerdict(args: {
  asset: string;
  entry: TrialLeg;
  followUp?: TrialLeg;
  followUpLabel?: string;
  followUpMode?: "close" | "current";
}) {
  const { asset, entry, followUp, followUpLabel, followUpMode = "close" } = args;
  const entryVerdict = buildVerdictBoard({
    asset,
    intent: entry.tradeAssessment.intent,
    enteredAtLabel: entry.enteredAtLabel,
    tradeAssessment: entry.tradeAssessment,
  });

  if (!followUp) {
    return entryVerdict;
  }

  const followUpVerdict = buildVerdictBoard({
    asset,
    intent: followUp.tradeAssessment.intent,
    enteredAtLabel: followUp.enteredAtLabel,
    tradeAssessment: followUp.tradeAssessment,
  });
  const score =
    outcomeWeight(entryVerdict.outcome) +
    (followUpMode === "current"
      ? currentPositionWeight(followUpVerdict.outcome)
      : outcomeWeight(followUpVerdict.outcome));
  const outcome =
    score > 0 ? "Acquitted" : score < 0 ? "Convicted" : "Contested";
  const followUpName = followUpLabel ?? "Follow-up";

  return {
    outcome,
    stamp:
      followUpMode === "current"
        ? outcome === "Acquitted"
          ? "POSITION DEFENDED"
          : outcome === "Convicted"
            ? "POSITION AT RISK"
            : "POSITION CONTESTED"
        : outcome === "Acquitted"
          ? "ROUND TRIP DEFENDED"
          : outcome === "Convicted"
            ? "ROUND TRIP CONVICTED"
            : "MIXED RECORD",
    summary:
      followUpMode === "current"
        ? outcome === "Acquitted"
          ? `The ${asset} position still stands. ${entryVerdict.summary} Current record: ${followUp.tradeAssessment.recommendedAction}`
          : outcome === "Convicted"
            ? `The ${asset} position is now difficult to defend. ${entryVerdict.summary} Current record: ${followUp.tradeAssessment.recommendedAction}`
            : `The ${asset} position is split between the opening and the current tape. ${entryVerdict.summary} Current record: ${followUp.tradeAssessment.recommendedAction}`
        : outcome === "Acquitted"
          ? `The ${asset} case survives review. ${entryVerdict.summary} ${followUpVerdict.summary}`
          : outcome === "Convicted"
            ? `The ${asset} case breaks under review. ${entryVerdict.summary} ${followUpVerdict.summary}`
            : `The ${asset} case is split. ${entryVerdict.summary} ${followUpVerdict.summary}`,
    reasons: [
      `Entry: ${entryVerdict.summary}`,
      `${followUpName}: ${
        followUpMode === "current"
          ? followUp.tradeAssessment.recommendedAction
          : followUpVerdict.summary
      }`,
      `Entry guidance: ${entry.tradeAssessment.recommendedAction}`,
      `${followUpName} guidance: ${followUp.tradeAssessment.recommendedAction}`,
    ],
    guidance:
      followUpMode === "current"
        ? outcome === "Acquitted"
          ? `The opening still survives and the live tape does not yet demand a close. ${followUp.tradeAssessment.recommendedAction}`
          : outcome === "Convicted"
            ? `The case may have been admissible at entry, but the live tape now argues for de-risking. ${followUp.tradeAssessment.recommendedAction}`
            : `The opening is arguable, but the live tape is no longer clean. ${followUp.tradeAssessment.recommendedAction}`
        : outcome === "Acquitted"
          ? `The market record can defend both legs of the case. ${followUp.tradeAssessment.recommendedAction}`
          : outcome === "Convicted"
            ? `At least one leg still fails the market record. ${followUp.tradeAssessment.recommendedAction}`
            : `One leg survives and one does not. Reconstruct both timestamps before repeating this trade.`,
    winner:
      score > 0
        ? "Defense"
        : score < 0
          ? "Prosecutor"
          : followUpMode === "current"
            ? followUpVerdict.outcome === "Convicted"
              ? "Defense"
              : "Prosecutor"
            : followUpVerdict.outcome === "Acquitted"
              ? "Defense"
              : "Prosecutor",
  } satisfies VerdictBoard;
}

function getRoleLabel(role: CourtRole) {
  if (role === "Defense") return "Trader Defense";
  if (role === "Judge") return "Judge";
  return "Prosecutor";
}

function getVerdictSpeech(verdict: VerdictBoard) {
  return `${verdict.summary} ${verdict.guidance}`;
}

const openingSpeech =
  "Order. The court will hear this trade as filed. Defense and prosecution will examine the tape one statement at a time before the ruling is delivered.";

async function fetchHistoricalRecord(asset: string, timestamp: string) {
  const parsedTimestamp = new Date(timestamp).getTime();

  if (!Number.isFinite(parsedTimestamp) || parsedTimestamp <= 0) {
    throw new Error("Invalid timestamp");
  }

  const search = new URLSearchParams({
    asset,
    timestamp: String(parsedTimestamp),
  });
  const response = await fetch(`/api/market-record?${search.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to load historical record (${response.status})`);
  }

  return (await response.json()) as MarketRecordPayload;
}

function getRecordSourceLabel(record: MarketRecordPayload) {
  return record.source === "pyth-pro" ? "Pyth Pro Record" : "Mock Fallback";
}

function CourtPortrait({
  role,
  state,
  variant = "stage",
  expression = "idle",
}: {
  role: CourtRole;
  state: string;
  variant?: "stage" | "judge";
  expression?: PortraitExpression;
}) {
  return (
    <div
      className={`courtPortrait ${variant} role${role} state${state} expression${expression}`}
      aria-hidden="true"
    >
      <div className="courtPortraitInner">
        <img
          className="courtPortraitImage"
          src={rolePortraits[role]}
          alt=""
          loading="eager"
          decoding="sync"
          draggable={false}
        />
      </div>
    </div>
  );
}

export function TradeTrialExperience() {
  const [asset, setAsset] = useState<SupportedAsset>("BTC / USD");
  const [intent, setIntent] = useState<(typeof caseSides)[number]>("Long");
  const [enteredAt, setEnteredAt] = useState(() =>
    toDateTimeLocalValue(new Date()),
  );
  const [closedAt, setClosedAt] = useState("");
  const [stillOpen, setStillOpen] = useState(true);
  const [orderSize, setOrderSize] = useState(15_000);
  const [leverage, setLeverage] = useState(5);
  const [entryPriceText, setEntryPriceText] = useState("");
  const [entryPriceTouched, setEntryPriceTouched] = useState(false);
  const [closePriceText, setClosePriceText] = useState("");
  const [closePriceTouched, setClosePriceTouched] = useState(false);
  const [showAdvancedFiling, setShowAdvancedFiling] = useState(false);
  const [isPreparingTrial, setIsPreparingTrial] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [phase, setPhase] = useState<TrialPhase>("intake");
  const [trialRun, setTrialRun] = useState<TrialRun | null>(null);
  const [activeBeatIndex, setActiveBeatIndex] = useState(0);
  const [showImpactStamp, setShowImpactStamp] = useState(false);
  const [typedCharacters, setTypedCharacters] = useState(0);
  const [selectedProofIndex, setSelectedProofIndex] = useState(0);
  const [showDossier, setShowDossier] = useState(false);
  const lastDialogueBlipRef = useRef(0);
  const {
    input,
    state,
    status,
    notice,
  } = useMarketStream({
    asset,
    provider: apiMarketProvider,
  });

  useEffect(() => {
    setEntryPriceTouched(false);
    setEntryPriceText("");
    setClosePriceTouched(false);
    setClosePriceText("");
  }, [asset, intent]);

  useEffect(() => {
    if (!input || entryPriceTouched) {
      return;
    }

    setEntryPriceText(getDefaultEntryPrice(input, intent).toFixed(2));
  }, [input, intent, entryPriceTouched]);

  useEffect(() => {
    if (!input || closePriceTouched || stillOpen) {
      return;
    }

    setClosePriceText(getDefaultEntryPrice(input, "Exit").toFixed(2));
  }, [input, closePriceTouched, stillOpen]);

  const activeBeat = trialRun?.beats[activeBeatIndex] ?? null;
  const activeVerdict = trialRun?.verdict ?? null;
  const activeSpeaker =
    phase === "opening" || phase === "renderVerdict" || phase === "verdict"
      ? "Judge"
      : activeBeat?.speaker ?? "Judge";
  const stageFocusClass =
    phase === "trial" && activeBeat
      ? `focus${activeBeat.speaker}`
      : phase === "opening" || phase === "renderVerdict" || phase === "verdict"
        ? "focusJudge"
        : "";
  const typedDialogue =
    phase === "opening"
      ? openingSpeech.slice(0, typedCharacters)
      : phase === "verdict"
      ? activeVerdict
        ? getVerdictSpeech(activeVerdict).slice(0, typedCharacters)
        : ""
      : activeBeat?.speech.slice(0, typedCharacters) ?? "";
  const isTyping =
    phase === "opening"
      ? typedCharacters < openingSpeech.length
      : phase === "verdict"
      ? activeVerdict
        ? typedCharacters < getVerdictSpeech(activeVerdict).length
        : false
      : activeBeat
        ? typedCharacters < activeBeat.speech.length
        : false;
  const activeProof =
    phase === "trial" && activeBeat
      ? activeBeat.proofs[selectedProofIndex] ?? activeBeat.proofs[0] ?? null
      : null;

  useEffect(() => {
    if (phase !== "opening") {
      return;
    }

    const typeDuration = Math.max(1_000, openingSpeech.length * 16);
    const typeStepMs = Math.max(
      18,
      Math.floor(typeDuration / Math.max(openingSpeech.length, 1)),
    );

    playCourtroomCue("opening");
    setTypedCharacters(0);

    const typingInterval = window.setInterval(() => {
      setTypedCharacters((current) => {
        if (current >= openingSpeech.length) {
          window.clearInterval(typingInterval);
          return current;
        }

        return current + 1;
      });
    }, typeStepMs);

    return () => {
      window.clearInterval(typingInterval);
    };
  }, [phase]);

  useEffect(() => {
    lastDialogueBlipRef.current = 0;
  }, [phase, activeBeatIndex]);

  useEffect(() => {
    if (phase !== "trial" || !trialRun || !activeBeat) {
      return;
    }

    const typeDuration = Math.max(780, activeBeat.speech.length * 18);
    const typeStepMs = Math.max(
      18,
      Math.floor(typeDuration / Math.max(activeBeat.speech.length, 1)),
    );

    playCourtroomCue(activeBeat.tone);
    setShowImpactStamp(activeBeat.tone === "attack" || activeBeat.tone === "defense");
    setTypedCharacters(0);
    setSelectedProofIndex(0);

    const typingInterval = window.setInterval(() => {
      setTypedCharacters((current) => {
        if (current >= activeBeat.speech.length) {
          window.clearInterval(typingInterval);
          return current;
        }

        return current + 1;
      });
    }, typeStepMs);

    const stampTimeout = window.setTimeout(() => {
      setShowImpactStamp(false);
    }, 420);

    return () => {
      window.clearInterval(typingInterval);
      window.clearTimeout(stampTimeout);
    };
  }, [phase, trialRun, activeBeatIndex, activeBeat]);

  useEffect(() => {
    if (phase !== "renderVerdict") {
      return;
    }

    playCourtroomCue("gavel");
  }, [phase]);

  useEffect(() => {
    if (phase !== "verdict" || !activeVerdict) {
      return;
    }

    const speech = getVerdictSpeech(activeVerdict);
    const typeDuration = Math.max(1_100, speech.length * 18);
    const typeStepMs = Math.max(
      18,
      Math.floor(typeDuration / Math.max(speech.length, 1)),
    );

    playCourtroomCue(
      activeVerdict.outcome === "Acquitted"
        ? "victory"
        : activeVerdict.outcome === "Convicted"
          ? "defeat"
          : "verdict",
    );
    setShowImpactStamp(true);
    setTypedCharacters(0);

    const typingInterval = window.setInterval(() => {
      setTypedCharacters((current) => {
        if (current >= speech.length) {
          window.clearInterval(typingInterval);
          return current;
        }

        return current + 1;
      });
    }, typeStepMs);

    const stampTimeout = window.setTimeout(() => {
      setShowImpactStamp(false);
    }, 540);

    return () => {
      window.clearInterval(typingInterval);
      window.clearTimeout(stampTimeout);
    };
  }, [phase, activeVerdict]);

  useEffect(() => {
    if (!isTyping || typedCharacters === 0) {
      return;
    }

    if (typedCharacters === lastDialogueBlipRef.current) {
      return;
    }

    if (typedCharacters % 3 !== 0) {
      return;
    }

    playDialogueBlip(activeSpeaker);
    lastDialogueBlipRef.current = typedCharacters;
  }, [activeSpeaker, isTyping, typedCharacters]);

  const advanceHearing = useEffectEvent(() => {
    if (phase === "opening") {
      if (typedCharacters < openingSpeech.length) {
        setTypedCharacters(openingSpeech.length);
        return;
      }

      setPhase("trial");
      return;
    }

    if (phase === "trial" && activeBeat && trialRun) {
      if (typedCharacters < activeBeat.speech.length) {
        setTypedCharacters(activeBeat.speech.length);
        return;
      }

      if (activeBeatIndex >= trialRun.beats.length - 1) {
        setPhase("renderVerdict");
        setShowImpactStamp(false);
        return;
      }

      setActiveBeatIndex((current) => current + 1);
      return;
    }

    if (phase === "renderVerdict") {
      setPhase("verdict");
    }
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== "opening" && phase !== "trial" && phase !== "renderVerdict") {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName ?? "";
      if (tagName === "INPUT" || tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      event.preventDefault();
      advanceHearing();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, advanceHearing]);

  if (!input || !state) {
    return (
      <section className="trialSceneShell">
        <div className="trialSceneGlow trialSceneGlowLeft" />
        <div className="trialSceneGlow trialSceneGlowRight" />
        <div className="intakeScene">
          <div className="intakeHero">
            <PythBrand />
            <h1>Trade Trial</h1>
            <p>Loading the courtroom record and waiting for Pyth evidence.</p>
          </div>
        </div>
      </section>
    );
  }

  const activeInput = input;
  const activeState = state;
  const liveReferencePrice = getDefaultEntryPrice(input, intent);
  const liveCloseReferencePrice = getDefaultEntryPrice(input, "Exit");
  const parsedEntryPrice = Number(entryPriceText);
  const parsedClosePrice = Number(closePriceText);
  const effectiveEntryPrice =
    Number.isFinite(parsedEntryPrice) && parsedEntryPrice > 0
      ? parsedEntryPrice
      : liveReferencePrice;
  const effectiveClosePrice =
    Number.isFinite(parsedClosePrice) && parsedClosePrice > 0
      ? parsedClosePrice
      : liveCloseReferencePrice;
  const tradeAssessment = assessTradeTicket({
    input: activeInput,
    state: activeState,
    intent,
    orderSize,
    leverage,
    entryPrice: effectiveEntryPrice,
  });
  const enteredAtLabel = formatEnteredAt(enteredAt);
  const closedAtLabel =
    stillOpen || !closedAt ? "Still open" : formatEnteredAt(closedAt);
  const sourceLabel =
    status === "live"
      ? "Pyth Pro Live"
      : status === "warming"
        ? "Pyth Pro Warm-up"
        : "Mock Fallback";
  const canStartTrial =
    Boolean(enteredAt) && (stillOpen || Boolean(closedAt)) && effectiveEntryPrice > 0;
  const filingSummary = [
    asset,
    intent === "Long" ? "Buy" : intent === "Short" ? "Sell" : "Exit",
    `Opened ${enteredAtLabel}`,
    stillOpen ? "Still Open" : `Closed ${closedAtLabel}`,
  ];
  const compactFilingLine = filingSummary.join(" · ");

  const defenseStateClass =
    phase === "verdict"
      ? activeVerdict?.winner === "Defense"
        ? "winner"
        : "loser"
      : phase === "renderVerdict"
        ? "idle"
        : activeSpeaker === "Defense"
          ? "active"
          : "idle";
  const prosecutorStateClass =
    phase === "verdict"
      ? activeVerdict?.winner === "Prosecutor"
        ? "winner"
        : "loser"
      : phase === "renderVerdict"
        ? "idle"
        : activeSpeaker === "Prosecutor"
          ? "active"
          : "idle";
  const judgeStateClass =
    phase === "verdict" || phase === "renderVerdict" || activeSpeaker === "Judge"
      ? "active"
      : "idle";
  const promptText =
    phase === "renderVerdict"
      ? "Press any key to hear the ruling."
      : isTyping
        ? "Press any key to complete the statement."
        : activeBeatIndex >= (trialRun?.beats.length ?? 1) - 1
          ? "Press any key to render the verdict."
          : "Press any key to continue the hearing.";
  const defenseExpression: PortraitExpression =
    phase === "trial"
      ? activeSpeaker === "Defense"
        ? showImpactStamp
          ? "emphasis"
          : isTyping
            ? "speaking"
            : "idle"
        : activeSpeaker === "Prosecutor" && showImpactStamp
          ? "shocked"
          : "stoic"
      : phase === "verdict"
        ? activeVerdict?.winner === "Defense"
          ? "emphasis"
          : "stoic"
        : "idle";
  const prosecutorExpression: PortraitExpression =
    phase === "trial"
      ? activeSpeaker === "Prosecutor"
        ? showImpactStamp
          ? "emphasis"
          : isTyping
            ? "speaking"
            : "idle"
        : activeSpeaker === "Defense" && showImpactStamp
          ? "shocked"
          : "stoic"
      : phase === "verdict"
        ? activeVerdict?.winner === "Prosecutor"
          ? "emphasis"
          : "stoic"
        : "idle";
  const judgeExpression: PortraitExpression =
    phase === "opening"
      ? isTyping
        ? "speaking"
        : "stoic"
      : phase === "renderVerdict"
        ? "gavel"
        : phase === "verdict"
          ? isTyping
            ? "speaking"
            : "emphasis"
          : "stoic";

  async function startTrial() {
    setIsPreparingTrial(true);
    setPreparationError(null);

    try {
      const entryRecord = await fetchHistoricalRecord(asset, enteredAt);
      const entryLeg: TrialLeg = {
        asset: entryRecord.input.asset,
        enteredAtLabel,
        sourceLabel: getRecordSourceLabel(entryRecord),
        sourceNotice: entryRecord.notice,
        tradeAssessment: assessTradeTicket({
          input: entryRecord.input,
          state: entryRecord.state,
          intent,
          orderSize,
          leverage,
          entryPrice:
            Number.isFinite(parsedEntryPrice) && parsedEntryPrice > 0
              ? parsedEntryPrice
              : getDefaultEntryPrice(entryRecord.input, intent),
        }),
        state: entryRecord.state,
      };

      let followUpLeg: TrialLeg | undefined;
      let followUpLabel: string | undefined;
      let followUpMode: "close" | "current" | undefined;

      if (!stillOpen && closedAt) {
        const closeRecord = await fetchHistoricalRecord(asset, closedAt);
        followUpLeg = {
          asset: closeRecord.input.asset,
          enteredAtLabel: closedAtLabel,
          sourceLabel: getRecordSourceLabel(closeRecord),
          sourceNotice: closeRecord.notice,
          tradeAssessment: assessTradeTicket({
            input: closeRecord.input,
            state: closeRecord.state,
            intent: "Exit",
            orderSize,
            leverage: 1,
            entryPrice:
              Number.isFinite(parsedClosePrice) && parsedClosePrice > 0
                ? parsedClosePrice
                : getDefaultEntryPrice(closeRecord.input, "Exit"),
          }),
          state: closeRecord.state,
        };
        followUpLabel = "Close";
        followUpMode = "close";
      } else if (stillOpen) {
        followUpLeg = {
          asset: activeInput.asset,
          enteredAtLabel: "Current Position",
          sourceLabel,
          sourceNotice: notice,
          tradeAssessment: assessTradeTicket({
            input: activeInput,
            state: activeState,
            intent: "Exit",
            orderSize,
            leverage: 1,
            entryPrice: getDefaultEntryPrice(activeInput, "Exit"),
          }),
          state: activeState,
        };
        followUpLabel = "Current Position";
        followUpMode = "current";
      }

      const nextRun = {
        enteredAtLabel: stillOpen ? enteredAtLabel : `${enteredAtLabel} -> ${closedAtLabel}`,
        beats: [
          ...buildCaseBeats(entryLeg, "entry", "Entry"),
          ...(followUpLeg
            ? buildCaseBeats(
                followUpLeg,
                followUpMode === "current" ? "current" : "close",
                followUpLabel ?? "Close",
              )
            : []),
        ],
        verdict: buildCombinedVerdict({
          asset: entryLeg.asset,
          entry: entryLeg,
          followUp: followUpLeg,
          followUpLabel,
          followUpMode,
        }),
        dossier: [
          ...buildCaseDossier(entryLeg, "entry", "Entry"),
          ...(followUpLeg
            ? buildCaseDossier(
                followUpLeg,
                followUpMode === "current" ? "current" : "close",
                followUpLabel ?? "Close",
              )
            : []),
        ],
      } satisfies TrialRun;

      setTrialRun(nextRun);
      setActiveBeatIndex(0);
      setSelectedProofIndex(0);
      setTypedCharacters(0);
      setShowImpactStamp(false);
      setShowDossier(false);
      setShowAdvancedFiling(false);
      setPhase("opening");
    } catch (error) {
      setPreparationError(
        error instanceof Error ? error.message : "Unable to prepare the historical case.",
      );
    } finally {
      setIsPreparingTrial(false);
    }
  }

  function resetCase() {
    setPhase("intake");
    setTrialRun(null);
    setActiveBeatIndex(0);
    setSelectedProofIndex(0);
    setShowImpactStamp(false);
    setTypedCharacters(0);
    setShowDossier(false);
    setShowAdvancedFiling(false);
    setPreparationError(null);
  }

  if (phase === "intake") {
    return (
      <section className="trialSceneShell">
        <div className="trialSceneGlow trialSceneGlowLeft" />
        <div className="trialSceneGlow trialSceneGlowRight" />

        <div className="intakeScene">
          <header className="intakeHero">
            <img
              className="intakeWordmark"
              src="/brand/pyth-logo-wordmark-light.svg"
              alt="Pyth"
            />
            <span className="panelEyebrow">Powered By Pyth Oracle</span>
            <h1>
              The Market
              <span className="intakeHeroAccent">Witness</span>
            </h1>
            <p>Your trades will be judged.</p>
          </header>

          <section className="caseTerminal" aria-label="Trade intake terminal">
            <label className="field">
              <span>Select Asset</span>
              <select
                value={asset}
                onChange={(event) => setAsset(event.target.value as SupportedAsset)}
                className="ticketInput trialSelect"
              >
                {supportedAssets.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>

            <div className="field">
              <span>What Did You Do?</span>
              <div className="actionGrid">
                {(["Long", "Short"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    className={`actionChip${side === intent ? " active" : ""}`}
                    onClick={() => setIntent(side)}
                    aria-pressed={side === intent}
                  >
                    {side === "Long" ? "Buy" : "Sell"}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>When Did You Open?</span>
              <input
                type="datetime-local"
                value={enteredAt}
                onChange={(event) => setEnteredAt(event.target.value)}
                className="ticketInput"
              />
            </label>

            <label className="field">
              <span>When Did You Close?</span>
              <input
                type="datetime-local"
                value={closedAt}
                onChange={(event) => setClosedAt(event.target.value)}
                className="ticketInput"
                disabled={stillOpen}
              />
            </label>

            <label className="trialCheckboxRow">
              <input
                type="checkbox"
                checked={stillOpen}
                onChange={(event) => {
                  setStillOpen(event.target.checked);
                  if (event.target.checked) {
                    setClosedAt("");
                  }
                }}
              />
              <span>Still open (judge current position)</span>
            </label>

            <button
              type="button"
              className="advancedToggleButton"
              onClick={() => setShowAdvancedFiling((current) => !current)}
              aria-expanded={showAdvancedFiling}
            >
              {showAdvancedFiling ? "Hide Advanced Filing" : "Add Advanced Filing"}
            </button>

            {showAdvancedFiling ? (
              <div className="advancedFilingPanel">
                <div className="trialFormGrid">
                  <label className="field">
                    <span>Position Size</span>
                    <input
                      type="number"
                      min={1_000}
                      max={250_000}
                      step={1_000}
                      value={orderSize}
                      onChange={(event) =>
                        setOrderSize(
                          Math.min(
                            250_000,
                            Math.max(1_000, Number(event.target.value) || 1_000),
                          ),
                        )
                      }
                      className="ticketInput"
                    />
                    <div className="fieldHint">
                      Guard cap now: {formatCurrency(tradeAssessment.guardCap)}
                    </div>
                  </label>

                  <label className="field">
                    <span>Leverage</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      step={1}
                      value={leverage}
                      onChange={(event) =>
                        setLeverage(
                          Math.min(50, Math.max(1, Number(event.target.value) || 1)),
                        )
                      }
                      className="ticketInput"
                    />
                    <input
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={leverage}
                      onChange={(event) => setLeverage(Number(event.target.value))}
                      className="sizeSlider"
                    />
                    <div className="fieldHint">{leverage}x is entered into evidence.</div>
                  </label>
                </div>

                <label className="field">
                  <span>Entry Price</span>
                  <div className="fieldControlRow">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={entryPriceText}
                      onChange={(event) => {
                        setEntryPriceTouched(true);
                        setEntryPriceText(event.target.value);
                      }}
                      className="ticketInput"
                    />
                    <button
                      type="button"
                      className="inlineActionButton"
                      onClick={() => {
                        setEntryPriceTouched(false);
                        setEntryPriceText(liveReferencePrice.toFixed(2));
                      }}
                    >
                      Use Live
                    </button>
                  </div>
                    <div className="fieldHint">
                      Live reference: {formatPrice(liveReferencePrice, asset)}
                    </div>
                </label>

                {!stillOpen ? (
                  <label className="field">
                    <span>Close Price</span>
                    <div className="fieldControlRow">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={closePriceText}
                        onChange={(event) => {
                          setClosePriceTouched(true);
                          setClosePriceText(event.target.value);
                        }}
                        className="ticketInput"
                      />
                      <button
                        type="button"
                        className="inlineActionButton"
                        onClick={() => {
                          setClosePriceTouched(false);
                          setClosePriceText(liveCloseReferencePrice.toFixed(2));
                        }}
                      >
                        Use Live
                      </button>
                    </div>
                    <div className="fieldHint">
                      Exit reference: {formatPrice(effectiveClosePrice, asset)}
                    </div>
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="caseTerminalFooter">
              <p className="intakeFootnote">
                {preparationError
                  ? preparationError
                  : "Evidence sourced from Pyth Price Feeds, Pyth Pro and Benchmarks."}
              </p>
              <button
                type="button"
                className="trialLaunchButton"
                onClick={() => void startTrial()}
                disabled={!canStartTrial || isPreparingTrial}
              >
                {isPreparingTrial
                  ? "Preparing Case..."
                  : canStartTrial
                    ? "Start Trial"
                    : "Fill Required Fields"}
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (!trialRun || !activeVerdict) {
    return null;
  }

  if (phase === "opening") {
    return (
      <section className="trialSceneShell">
        <div className="trialSceneGlow trialSceneGlowLeft" />
        <div className="trialSceneGlow trialSceneGlowRight" />

        <div className="courtroomScene courtroomSceneExpanded">
          <header className="courtroomHeader trialHeaderExpanded compact">
            <PythBrand />
            <p className="trialSceneMeta">{compactFilingLine}</p>
          </header>

          <section className="trialCourtStage openingStage focusJudge">
            <article className="trialJudgeBench stateactive ruling openingBench">
              <div className="trialJudgeSealRow">
                <img
                  className="trialJudgeLogo"
                  src="/brand/pyth-logo-light.svg"
                  alt="Pyth"
                />
                <span className="trialJudgeTag">Court Is Now In Session</span>
              </div>
              <CourtPortrait
                role="Judge"
                state="active"
                variant="judge"
                expression={judgeExpression}
              />
              <div className="dialogueConsole tonewarning fullWidth rulingConsole">
                <div className="dialogueConsoleTop">
                  <span className="panelEyebrow">Opening Order</span>
                  <span className="caseMetaTag subtle">Judge</span>
                </div>
                <strong className="dialogueSpeakerName">Judge</strong>
                <p className="dialogueText">
                  {typedDialogue}
                  <span
                    className={`dialogueCursor${isTyping ? " visible" : ""}`}
                    aria-hidden="true"
                  >
                    _
                  </span>
                </p>
              </div>
            </article>

            <div className="trialAdvanceStrip center">
              <span className="trialAdvancePrompt">
                {isTyping
                  ? "Press any key to complete the opening order."
                  : "Press any key to begin the hearing."}
              </span>
              <button
                type="button"
                className="trialLaunchButton"
                onClick={advanceHearing}
              >
                {isTyping ? "Complete Opening" : "Begin Hearing"}
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (phase === "trial" && activeBeat) {
    return (
      <section className="trialSceneShell">
        <div className="trialSceneGlow trialSceneGlowLeft" />
        <div className="trialSceneGlow trialSceneGlowRight" />

        <div className={`impactStamp${showImpactStamp ? " visible" : ""}`}>
          {activeBeat.cue.toUpperCase()}
        </div>

        <div className="courtroomScene courtroomSceneExpanded">
          <header className="courtroomHeader trialHeaderExpanded compact">
            <PythBrand />
            <p className="trialSceneMeta">{compactFilingLine}</p>
          </header>

          <section
            className={`trialCourtStage ${stageFocusClass}${showImpactStamp ? " shockAttack" : ""}`}
          >
            <div className="trialCourtChrome" aria-hidden="true" />

            <div className={`trialCastLayout hearingDuel ${stageFocusClass}`}>
              <article className={`trialCounselPanel roleDefense state${defenseStateClass}`}>
                <span className="trialCounselSide">Defense</span>
                <CourtPortrait
                  role="Defense"
                  state={defenseStateClass}
                  expression={defenseExpression}
                />
                <strong className="trialCounselName">{getRoleLabel("Defense")}</strong>
              </article>

              <article className={`trialCounselPanel roleProsecutor state${prosecutorStateClass}`}>
                <span className="trialCounselSide">Prosecutor</span>
                <CourtPortrait
                  role="Prosecutor"
                  state={prosecutorStateClass}
                  expression={prosecutorExpression}
                />
                <strong className="trialCounselName">{getRoleLabel("Prosecutor")}</strong>
              </article>
            </div>

            <div className={`trialSpeakerFocusRow ${stageFocusClass}`}>
              <div
                className={`dialogueConsole tone${activeBeat.tone} fullWidth align${activeBeat.speaker}`}
              >
                <div className="dialogueConsoleTop">
                  <span className="panelEyebrow">{activeBeat.headline}</span>
                  <span className="caseMetaTag subtle">
                    Statement {activeBeatIndex + 1} / {trialRun.beats.length}
                  </span>
                </div>
                <strong className="dialogueSpeakerName">
                  {getRoleLabel(activeBeat.speaker)}
                </strong>
                <p className="dialogueText">
                  {typedDialogue}
                  <span
                    className={`dialogueCursor${isTyping ? " visible" : ""}`}
                    aria-hidden="true"
                  >
                    _
                  </span>
                </p>
              </div>
            </div>

            <section className={`trialProofBoard align${activeBeat.speaker}`}>
              <div className="dialogueConsoleTop">
                <span className="panelEyebrow">Pyth Evidence</span>
                <div className="trialProofNavigator">
                  <button
                    type="button"
                    className="proofStepButton"
                    onClick={() =>
                      setSelectedProofIndex((current) =>
                        activeBeat.proofs.length === 0
                          ? 0
                          : (current - 1 + activeBeat.proofs.length) % activeBeat.proofs.length,
                      )
                    }
                    disabled={activeBeat.proofs.length <= 1}
                  >
                    Prev
                  </button>
                  <span className="caseMetaTag subtle">
                    Proof {selectedProofIndex + 1} / {activeBeat.proofs.length}
                  </span>
                  <button
                    type="button"
                    className="proofStepButton"
                    onClick={() =>
                      setSelectedProofIndex((current) =>
                        activeBeat.proofs.length === 0
                          ? 0
                          : (current + 1) % activeBeat.proofs.length,
                      )
                    }
                    disabled={activeBeat.proofs.length <= 1}
                  >
                    Next
                  </button>
                </div>
              </div>
              {activeProof ? (
                <article className={`trialProofDetail trialProofDetailHero trend${activeProof.trend}`}>
                  <div className="trialProofDetailTop">
                    <strong>{activeProof.label}</strong>
                    <span className="caseMetaTag subtle">{activeProof.source}</span>
                  </div>
                  <div className="trialProofMetric">
                    <strong className="trialProofValueHero">{activeProof.value}</strong>
                    <span className="trialProofDeltaHero">{activeProof.delta}</span>
                  </div>
                  <p>{activeProof.note}</p>
                  <div className="trialProofFoot">
                    <span className="caseMetaTag subtle">{activeProof.emphasis}</span>
                  </div>
                </article>
              ) : null}
            </section>

            <div className="trialAdvanceStrip">
              <span className="trialAdvancePrompt">{promptText}</span>
              <button
                type="button"
                className="trialLaunchButton"
                onClick={advanceHearing}
              >
                {isTyping
                  ? "Complete Statement"
                  : activeBeatIndex >= trialRun.beats.length - 1
                    ? "Render Verdict"
                    : "Continue Hearing"}
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  if (phase === "renderVerdict") {
    return (
      <section className="trialSceneShell">
        <div className="trialSceneGlow trialSceneGlowLeft" />
        <div className="trialSceneGlow trialSceneGlowRight" />

        <div className="courtroomScene courtroomSceneExpanded">
          <header className="courtroomHeader trialHeaderExpanded compact">
            <PythBrand />
            <p className="trialSceneMeta">{compactFilingLine}</p>
          </header>

          <section className="trialCourtStage verdictAlarmStage focusJudge">
            <div className="trialCastLayout focusJudge">
              <article className="trialCounselPanel roleDefense stateidle">
                <CourtPortrait role="Defense" state="idle" expression="stoic" />
                <strong className="trialCounselName">{getRoleLabel("Defense")}</strong>
              </article>

              <article className="trialJudgeBench stateactive">
                <CourtPortrait
                  role="Judge"
                  state="active"
                  variant="judge"
                  expression="gavel"
                />
                <div className="verdictAlarmWord">Render Verdict</div>
                <p className="verdictAlarmText">
                  The hearing is complete. The next key will trigger the ruling.
                </p>
              </article>

              <article className="trialCounselPanel roleProsecutor stateidle">
                <CourtPortrait role="Prosecutor" state="idle" expression="stoic" />
                <strong className="trialCounselName">{getRoleLabel("Prosecutor")}</strong>
              </article>
            </div>

            <div className="trialAdvanceStrip center">
              <span className="trialAdvancePrompt">{promptText}</span>
              <button
                type="button"
                className="trialLaunchButton"
                onClick={advanceHearing}
              >
                Hear The Verdict
              </button>
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="trialSceneShell">
      <div className="trialSceneGlow trialSceneGlowLeft" />
      <div className="trialSceneGlow trialSceneGlowRight" />

      <div className={`impactStamp${showImpactStamp ? " visible" : ""}`}>
        {activeVerdict.stamp}
      </div>

      <div className="verdictScene verdictSceneExpanded">
        <header className="verdictHero">
          <PythBrand />
          <span className="panelEyebrow">Verdict Delivered</span>
          <strong className={`verdictHeroWord outcome${activeVerdict.outcome.toLowerCase()}`}>
            {activeVerdict.outcome}
          </strong>
          <div className={`verdictHeroStamp outcome${activeVerdict.outcome.toLowerCase()}`}>
            {activeVerdict.stamp}
          </div>
          <p className="trialSceneMeta">{compactFilingLine}</p>
        </header>

        <section className="trialCourtStage verdictCourtStage">
          <div className="trialCastLayout">
            <article className={`trialCounselPanel roleDefense state${defenseStateClass}`}>
              <span className="trialCounselSide">Defense</span>
              <CourtPortrait
                role="Defense"
                state={defenseStateClass}
                expression={defenseExpression}
              />
              <strong className="trialCounselName">{getRoleLabel("Defense")}</strong>
            </article>

            <article className="trialJudgeBench stateactive ruling">
              <div className="trialJudgeSealRow">
                <img
                  className="trialJudgeLogo"
                  src="/brand/pyth-logo-light.svg"
                  alt="Pyth"
                />
                <span className="trialJudgeTag">Official Ruling</span>
              </div>
              <CourtPortrait
                role="Judge"
                state="winner"
                variant="judge"
                expression={judgeExpression}
              />
              <div className={`dialogueConsole toneverdict fullWidth rulingConsole`}>
                <div className="dialogueConsoleTop">
                  <span className="panelEyebrow">Judge's Ruling</span>
                  <span className="caseMetaTag subtle">{activeVerdict.stamp}</span>
                </div>
                <strong className="dialogueSpeakerName">Judge</strong>
                <p className="dialogueText">
                  {typedDialogue}
                  <span
                    className={`dialogueCursor${isTyping ? " visible" : ""}`}
                    aria-hidden="true"
                  >
                    _
                  </span>
                </p>
              </div>
            </article>

            <article className={`trialCounselPanel roleProsecutor state${prosecutorStateClass}`}>
              <span className="trialCounselSide">Prosecutor</span>
              <CourtPortrait
                role="Prosecutor"
                state={prosecutorStateClass}
                expression={prosecutorExpression}
              />
              <strong className="trialCounselName">{getRoleLabel("Prosecutor")}</strong>
            </article>
          </div>
        </section>

        <section className="verdictPanelFull">
          <p className="verdictHeroSummary">{activeVerdict.summary}</p>

          <div className="verdictReasonStack">
            {activeVerdict.reasons.map((reason) => (
              <article key={reason} className="verdictReasonPanel">
                {reason}
              </article>
            ))}
          </div>

          <article className="verdictGuidancePanel">
            <span className="panelEyebrow">Judge's Note</span>
            <p>{activeVerdict.guidance}</p>
          </article>

          <div className="verdictActionRow">
            <button
              type="button"
              className="trialLaunchButton"
              onClick={resetCase}
            >
              File Another Trade
            </button>
            <button
              type="button"
              className="modeActionButton subtle"
              onClick={() => setShowDossier((current) => !current)}
            >
              {showDossier ? "Hide Full Review" : "Read Full Review"}
            </button>
          </div>
        </section>

        {showDossier ? (
          <section className="trialDossierSection">
            <div className="trialProofBoardTop">
              <div>
                <span className="panelEyebrow">Detailed Review</span>
                <p className="trialProofLead">
                  Full evidence archive from the hearing and the final ruling.
                </p>
              </div>
              <span className="caseMetaTag subtle">{trialRun.enteredAtLabel}</span>
            </div>

            <div className="trialDossierGrid">
              {trialRun.dossier.map((proof) => (
                <article
                  key={proof.id}
                  className={`trialProofCard trialProofCardStatic trend${proof.trend}`}
                >
                  <span className="trialProofLabel">{proof.label}</span>
                  <strong className="trialProofValue">{proof.value}</strong>
                  <span className="trialProofDelta">{proof.delta}</span>
                  <span className="trialProofSource">{proof.source}</span>
                  <p className="trialProofNote">{proof.note}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
