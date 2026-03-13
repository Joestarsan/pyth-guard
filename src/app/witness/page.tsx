import { ModeNav } from "@/components/mode-nav";
import { WitnessBoard } from "@/components/witness-board";

export default function WitnessPage() {
  return (
    <main className="pageShell">
      <div className="pageGlow pageGlowTop" />
      <div className="pageGlow pageGlowBottom" />
      <ModeNav current="witness" />
      <WitnessBoard />
    </main>
  );
}
