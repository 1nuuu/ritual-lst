import type { Metadata } from "next";
import { AccessGate } from "@/components/AccessGate";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { StakingDashboard } from "@/components/StakingDashboard";

export const metadata: Metadata = {
  title: "Stake",
};

export default function StakePage() {
  return (
    <>
      <Nav />
      <main className="stake-page">
        <div className="stake-grid-bg" aria-hidden="true" />
        <div className="stake-shell">
          <AccessGate>
            <StakingDashboard />
          </AccessGate>
        </div>
      </main>
      <Footer />
    </>
  );
}
