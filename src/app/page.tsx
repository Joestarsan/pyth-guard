import { GuardDashboard } from "@/components/guard-dashboard";

export default function HomePage() {
  return (
    <main className="pageShell">
      <div className="pageGlow pageGlowTop" />
      <div className="pageGlow pageGlowBottom" />
      <GuardDashboard />
    </main>
  );
}
