import { TradeTrialExperience } from "@/components/trade-trial-experience";

export default function HomePage() {
  return (
    <main className="pageShell">
      <div className="pagePixelGrid" aria-hidden="true" />
      <div className="pagePixelNoise" aria-hidden="true" />
      <div className="pageBrandStamps" aria-hidden="true">
        <img className="pageBrandStamp stampOne" src="/brand/pyth-symbol-light.svg" alt="" />
        <img className="pageBrandStamp stampTwo" src="/brand/pyth-token.svg" alt="" />
        <img className="pageBrandStamp stampThree" src="/brand/pyth-symbol-light.svg" alt="" />
      </div>
      <TradeTrialExperience />
    </main>
  );
}
