import { EvidenceItem } from "@/lib/mock-market-state";

type EvidenceCardProps = {
  item: EvidenceItem;
  eyebrow?: string;
  className?: string;
};

export function EvidenceCard({ item, eyebrow, className }: EvidenceCardProps) {
  return (
    <article className={`evidenceCard trend${item.trend}${className ? ` ${className}` : ""}`}>
      {eyebrow ? <span className="evidenceEyebrow">{eyebrow}</span> : null}
      <div className="evidenceHeader">
        <span className="evidenceLabel">{item.label}</span>
        <span className="evidenceDelta">{item.delta}</span>
      </div>
      <div className="evidenceValue">{item.value}</div>
      <p className="evidenceNote">{item.note}</p>
    </article>
  );
}
