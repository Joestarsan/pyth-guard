"use client";

import Link from "next/link";
import { useEffect } from "react";

import { MarketSource, MarketStreamStatus } from "@/lib/market-data/types";
import { TradeAssessment } from "@/lib/trade-ticket";

type TrialVerdictOverlayProps = {
  caseId: string;
  source: MarketSource;
  status: MarketStreamStatus;
  notice?: string;
  tradeAssessment: TradeAssessment;
  onClose: () => void;
};

function playCourtCue() {
  if (typeof window === "undefined") return;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) return;

  const audioContext = new AudioContextCtor();
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.connect(audioContext.destination);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.36);

  const low = audioContext.createOscillator();
  low.type = "square";
  low.frequency.setValueAtTime(165, audioContext.currentTime);
  low.frequency.exponentialRampToValueAtTime(118, audioContext.currentTime + 0.16);
  low.connect(gain);
  low.start(audioContext.currentTime);
  low.stop(audioContext.currentTime + 0.3);

  const high = audioContext.createOscillator();
  high.type = "triangle";
  high.frequency.setValueAtTime(620, audioContext.currentTime + 0.04);
  high.frequency.exponentialRampToValueAtTime(380, audioContext.currentTime + 0.22);
  high.connect(gain);
  high.start(audioContext.currentTime + 0.04);
  high.stop(audioContext.currentTime + 0.28);

  window.setTimeout(() => {
    void audioContext.close();
  }, 420);
}

export function TrialVerdictOverlay({
  caseId,
  source,
  status,
  notice,
  tradeAssessment,
  onClose,
}: TrialVerdictOverlayProps) {
  useEffect(() => {
    playCourtCue();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sourceLabel = source === "pyth-pro" ? "Pyth Pro" : "Fallback";

  return (
    <div className="trialOverlayBackdrop" role="dialog" aria-modal="true">
      <section className="trialOverlay">
        <button
          type="button"
          className="trialCloseButton"
          onClick={onClose}
          aria-label="Dismiss trial overlay"
        >
          Close
        </button>

        <div className="trialTopline">
          <span className="panelEyebrow">Instant Courtroom Hearing</span>
          <span className={`assetBadge subtle status${status}`}>
            {sourceLabel} {status}
          </span>
        </div>

        <div className="trialStamp objection">OBJECTION</div>

        <div className="trialGrid">
          <div className="trialVerdictPanel">
            <span className="panelEyebrow">Ticket Verdict</span>
            <strong className="trialScore">{tradeAssessment.score}</strong>
            <strong className="trialVerdictWord">{tradeAssessment.verdict}</strong>
            <p className="trialVerdictCopy">{tradeAssessment.summary}</p>

            <div className="trialTagRow">
              <span className={`riskBadge risk${tradeAssessment.riskLevel}`}>
                {tradeAssessment.riskLevel}
              </span>
              <span className="caseMetaTag">{tradeAssessment.intent}</span>
              <span className="caseMetaTag">
                {Math.round(tradeAssessment.sizeRatio * 100)}% of cap
              </span>
            </div>

            <div className="trialObjectionList">
              {tradeAssessment.objections.map((item) => (
                <div key={item} className="trialObjectionItem">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="trialTranscriptPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Live Transcript</span>
              <strong>Why the court landed here</strong>
            </div>

            <div className="transcriptList trialTranscriptList">
              {tradeAssessment.lines.map((line, index) => (
                <article
                  key={`${line.role}-${index}`}
                  className={`transcriptLine role${line.role} trialLine`}
                  style={{ animationDelay: `${160 + index * 120}ms` }}
                >
                  <span className="transcriptRole">{line.role}</span>
                  <p>{line.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="trialOverlayFooter">
          {notice ? <p className="trialNotice">{notice}</p> : <span />}
          <div className="trialActionRow">
            <Link href={`/witness?case=${caseId}`} className="modeActionButton">
              Open Full Dossier
            </Link>
            <button
              type="button"
              className="modeActionButton subtle"
              onClick={onClose}
            >
              Stay in Guard
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
