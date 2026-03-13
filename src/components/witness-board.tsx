"use client";

import { useState } from "react";

import { EvidenceCard } from "@/components/evidence-card";
import { TimelineStrip } from "@/components/timeline-strip";
import { witnessCases } from "@/lib/replay/witness-cases";
import { computeMarketState } from "@/lib/trust-engine";

export function WitnessBoard() {
  const [selectedCaseId, setSelectedCaseId] = useState(witnessCases[0].id);
  const selectedCase =
    witnessCases.find((item) => item.id === selectedCaseId) ?? witnessCases[0];
  const caseState = computeMarketState(selectedCase.frame, selectedCase.timeline);

  return (
    <section className="witnessShell">
      <header className="witnessHero">
        <div>
          <span className="topKicker">Market Witness</span>
          <h1>Put the trade on trial.</h1>
          <p className="witnessHeroCopy">
            The same trust engine that protects execution in live mode becomes
            forensic evidence after the fact.
          </p>
        </div>

        <div className="heroMeta">
          <span className="assetBadge">{selectedCase.defendant}</span>
          <span className="assetBadge subtle">{selectedCase.charge}</span>
        </div>
      </header>

      <section className="witnessLayout">
        <aside className="caseRail">
          <div className="panelHeader">
            <span className="panelEyebrow">Cases</span>
            <strong>Trial Docket</strong>
          </div>

          <div className="caseList">
            {witnessCases.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`caseCard${item.id === selectedCase.id ? " active" : ""}`}
                onClick={() => setSelectedCaseId(item.id)}
              >
                <span className="caseTitle">{item.title}</span>
                <span className="caseSubtitle">{item.subtitle}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="witnessStage">
          <div className="witnessStageTop">
            <div className="verdictPanel">
              <span className="panelEyebrow">Verdict</span>
              <strong className="verdictWord">{selectedCase.verdict}</strong>
              <p className="verdictCopy">
                Recommended alternative: {selectedCase.recommendedAction}
              </p>
            </div>

            <div className="witnessScorePanel">
              <span className="panelEyebrow">Trust At Entry</span>
              <strong className="witnessScore">{caseState.trustScore}</strong>
              <span className={`riskBadge risk${caseState.riskLevel}`}>
                {caseState.riskLevel}
              </span>
            </div>
          </div>

          <div className="transcriptPanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Transcript</span>
              <strong>{selectedCase.title}</strong>
            </div>

            <div className="transcriptList">
              {selectedCase.lines.map((line, index) => (
                <article
                  key={`${line.role}-${index}`}
                  className={`transcriptLine role${line.role}`}
                >
                  <span className="transcriptRole">{line.role}</span>
                  <p>{line.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="witnessTimelinePanel">
            <div className="panelHeader">
              <span className="panelEyebrow">Trust Collapse Replay</span>
              <strong>Entry Conditions</strong>
            </div>
            <TimelineStrip values={caseState.timeline} />
          </div>
        </section>

        <aside className="witnessEvidencePanel">
          <div className="panelHeader">
            <span className="panelEyebrow">Exhibits</span>
            <strong>Pyth Evidence</strong>
          </div>

          <div className="evidenceStack">
            {caseState.evidence.map((item) => (
              <EvidenceCard key={item.label} item={item} />
            ))}
          </div>

          <div className="witnessStamp objection">OBJECTION</div>
        </aside>
      </section>
    </section>
  );
}
