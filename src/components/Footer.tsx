import { config } from "@/lib/config";

export function Footer() {
  return (
    <footer>
      <div className="logo" style={{ fontSize: "1.1rem" }}>
        {config.protocolName}
      </div>
      <div className="foot-r">Built on {config.chainName} / Testnet Only</div>
    </footer>
  );
}
