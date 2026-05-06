"use client";

import { config, prefixedSymbol } from "@/lib/config";

const ROWS = [
  [prefixedSymbol(config.lstSymbol), "COMING SOON", true],
  [config.protocolName, "COMING SOON", true],
  [config.tokenSymbol, "TESTNET LIVE", true],
  [config.chainName, "BUILD", true],
  ["EVM", "COMPATIBLE", true],
  [prefixedSymbol(config.lstSymbol), "LIQUID", true],
  [config.protocolName, "IDENTITY", true],
  [config.tokenSymbol, "COMING SOON", true],
] as const;

export function Ticker() {
  const items = [...ROWS, ...ROWS];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker-track">
        {items.map(([k, v, g], i) => (
          <span className="tick-item" key={i}>
            <span className={g ? "accent" : ""}>{k}</span>
            <span className="tick-sep">/</span>
            <span>{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
