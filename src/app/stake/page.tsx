"use client";

import { useEffect, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { StakingDashboard } from "@/components/StakingDashboard";
import type { ContractVersion } from "@/lib/contracts";

const readStakeVersionFromLocation = (): ContractVersion | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const version = new URLSearchParams(window.location.search).get("version");

  if (version === "v1" || version === "v2") {
    return version;
  }

  return null;
};

export default function StakePage() {
  const [version, setVersion] = useState<ContractVersion>("v2");

  useEffect(() => {
    const applyLocationVersion = (nextVersion: ContractVersion | null) => {
      setVersion(nextVersion ?? "v2");
    };

    const syncFromLocation = () => {
      applyLocationVersion(readStakeVersionFromLocation());
    };

    const handleStakeVersionChange = (event: Event) => {
      const nextVersion = (event as CustomEvent<ContractVersion>).detail;

      if (nextVersion === "v1" || nextVersion === "v2") {
        applyLocationVersion(nextVersion);
        return;
      }

      syncFromLocation();
    };

    syncFromLocation();
    window.addEventListener("popstate", syncFromLocation);
    window.addEventListener(
      "ritual-stake-version-change",
      handleStakeVersionChange,
    );

    return () => {
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener(
        "ritual-stake-version-change",
        handleStakeVersionChange,
      );
    };
  }, []);

  return (
    <>
      <Nav />
      <main className="stake-page">
        <div className="stake-grid-bg" aria-hidden="true" />
        <div className="stake-shell">
          {version === "v1" ? (
            <AccessGate>
              <StakingDashboard version="v1" />
            </AccessGate>
          ) : (
            <StakingDashboard version="v2" />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
