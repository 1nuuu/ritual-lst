import { useEffect } from "react";

const WALLET_SYNC_SESSION_KEY = "ritual:wallet-sync:v1";

export function useWalletSync(address: string | undefined) {
  useEffect(() => {
    if (!address) {
      return;
    }

    const normalizedAddress = address.toLowerCase();
    const sessionKey = `${WALLET_SYNC_SESSION_KEY}:${normalizedAddress}`;

    if (window.sessionStorage.getItem(sessionKey)) {
      return;
    }

    window.sessionStorage.setItem(sessionKey, String(Date.now()));

    void fetch("/api/wallet/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: normalizedAddress }),
    }).catch((err: unknown) => {
      window.sessionStorage.removeItem(sessionKey);
      console.warn("[useWalletSync] sync error:", err);
    });
  }, [address]);
}
