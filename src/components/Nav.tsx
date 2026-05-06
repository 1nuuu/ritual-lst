"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { config } from "@/lib/config";

export function Nav() {
  const [isLight, setIsLight] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const toggleTheme = () => {
    if (isLight) {
      document.body.removeAttribute("data-theme");
    } else {
      document.body.setAttribute("data-theme", "light");
    }
    setIsLight(!isLight);
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        walletMenuRef.current &&
        !walletMenuRef.current.contains(event.target as Node)
      ) {
        setWalletOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <nav>
      <div className="logo">{config.protocolName}</div>
      <div className="nav-right">
        <button
          className="theme-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {isLight ? "\u2600" : "\u25D0"}
        </button>

        {mounted ? (
          isConnected ? (
            <div className="wallet-menu" ref={walletMenuRef}>
              <button
                className="wallet-btn connected"
                onClick={() => setWalletOpen((open) => !open)}
                aria-expanded={walletOpen}
                aria-haspopup="menu"
              >
                <span className="wallet-dot" />
                <span>{truncate(address!)}</span>
                <span className="wallet-caret">v</span>
              </button>
              {walletOpen && (
                <div className="wallet-dropdown" role="menu">
                  <div className="wallet-dropdown-label">Connected wallet</div>
                  <div className="wallet-dropdown-address">{address}</div>
                  <button
                    className="wallet-disconnect"
                    role="menuitem"
                    onClick={() => {
                      setWalletOpen(false);
                      disconnect();
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              className="wallet-btn"
              onClick={() => connect({ connector: connectors[0] })}
            >
              Connect
            </button>
          )
        ) : (
          <button className="wallet-btn" style={{ visibility: "hidden" }}>
            Connect
          </button>
        )}
      </div>
    </nav>
  );
}
