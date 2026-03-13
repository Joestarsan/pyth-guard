import { EvidenceItem } from "@/lib/mock-market-state";

type EvidenceCardProps = {
  item: EvidenceItem;
};

export function EvidenceCard({ item }: EvidenceCardProps) {
  return (
    <article className={`evidenceCard trend${item.trend}`}>
      <div className="evidenceHeader">
        <span className="evidenceLabel">{item.label}</span>
        <span className="evidenceDelta">{item.delta}</span>
      </div>
      <div className="evidenceValue">{item.value}</div>
      <p className="evidenceNote">{item.note}</p>
    </article>
  );
}
