"use client";

import { useEffect } from "react";
import type { Connector } from "wagmi";

type WalletSelectModalProps = {
  connectors: readonly Connector[];
  isOpen: boolean;
  isPending?: boolean;
  onClose: () => void;
  onConnect: (connector: Connector) => void;
};

const getConnectorLabel = (connector: Connector) => {
  const name = connector.name?.trim();

  if (name && name.toLowerCase() !== "injected") {
    return name;
  }

  return "Browser Wallet";
};

const getConnectorMark = (connector: Connector) => {
  if (connector.id === "walletConnect") {
    return "QR";
  }

  if (
    connector.id === "coinbaseWallet" ||
    connector.id === "coinbaseWalletSDK"
  ) {
    return "CB";
  }

  if (connector.id === "injected") {
    return "BW";
  }

  return "WL";
};

const isWalletConnectConnector = (connector: Connector) =>
  connector.id === "walletConnect";

const getConnectorIcon = (connector: Connector): string | null => {
  // Use connector's own icon if available (EIP-6963 wallets)
  if (connector.icon) return connector.icon;

  // Hardcode SVG data URLs for known SDK connectors
  if (connector.id === "walletConnect") {
    return "https://avatars.githubusercontent.com/u/37784886?s=200&v=4";
  }

  if (
    connector.id === "coinbaseWalletSDK" ||
    connector.id === "coinbaseWallet"
  ) {
    return "https://avatars.githubusercontent.com/u/18060234?s=200&v=4";
  }

  return null;
};

const getFilteredConnectors = (connectors: readonly Connector[]) => {
  const hasSpecificInjected = connectors.some(
    (connector) => connector.id !== "injected" && connector.type === "injected",
  );

  return hasSpecificInjected
    ? connectors.filter((connector) => connector.id !== "injected")
    : connectors;
};

export function WalletSelectModal({
  connectors,
  isOpen,
  isPending = false,
  onClose,
  onConnect,
}: WalletSelectModalProps) {
  const filteredConnectors = getFilteredConnectors(connectors);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="wallet-select-backdrop" onClick={onClose}>
      <style>
        {`
          @keyframes walletSelectFadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes walletSelectCardIn {
            from {
              opacity: 0;
              transform: translateY(10px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          .wallet-select-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1200;
            display: grid;
            place-items: center;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.72);
            animation: walletSelectFadeIn 0.16s ease both;
          }

          .wallet-select-card {
            width: min(100%, 360px);
            overflow: hidden;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            background: var(--bg2);
            color: var(--text);
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
            animation: walletSelectCardIn 0.18s ease both;
          }

          .wallet-select-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 1rem;
            border-bottom: 1px solid var(--border);
          }

          .wallet-select-header h2 {
            margin: 0;
            color: var(--text);
            font-family: var(--font-body);
            font-size: 1rem;
            font-weight: 800;
            letter-spacing: 0;
          }

          .wallet-select-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: transparent;
            color: var(--muted);
            cursor: pointer;
            font-family: var(--font-mono);
            font-size: 0.9rem;
            transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
          }

          .wallet-select-close:hover,
          .wallet-select-close:focus-visible {
            border-color: rgba(25, 209, 132, 0.45);
            background: rgba(25, 209, 132, 0.08);
            color: var(--green);
            outline: none;
          }

          .wallet-select-list {
            display: grid;
            gap: 0.55rem;
            padding: 1rem;
          }

          .wallet-select-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.85rem;
            width: 100%;
            min-height: 3rem;
            padding: 0.75rem;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: rgba(255, 255, 255, 0.02);
            color: var(--text);
            cursor: pointer;
            font-family: var(--font-body);
            text-align: left;
            transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
          }

          .wallet-select-row:hover,
          .wallet-select-row:focus-visible {
            border-color: rgba(25, 209, 132, 0.45);
            background: rgba(25, 209, 132, 0.08);
            outline: none;
          }

          .wallet-select-row:disabled {
            cursor: not-allowed;
            opacity: 0.6;
          }

          .wallet-select-row-main {
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 0.75rem;
          }

          .wallet-select-mark {
            display: inline-flex;
            flex: 0 0 auto;
            align-items: center;
            justify-content: center;
            width: 2rem;
            height: 2rem;
            border: 1px solid rgba(25, 209, 132, 0.3);
            border-radius: var(--radius-sm);
            background: rgba(25, 209, 132, 0.08);
            color: var(--green);
            font-family: var(--font-mono);
            font-size: 0.7rem;
            font-weight: 800;
            letter-spacing: 0.04em;
          }

          .wallet-select-icon {
            display: block;
            flex: 0 0 auto;
            width: 2rem;
            height: 2rem;
            border-radius: var(--radius-sm);
            object-fit: cover;
          }

          .wallet-select-name {
            overflow: hidden;
            color: var(--text);
            font-size: 0.92rem;
            font-weight: 750;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .wallet-select-hint {
            flex: 0 0 auto;
            color: var(--muted2);
            font-family: var(--font-mono);
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .wallet-select-empty {
            padding: 0.85rem;
            border: 1px dashed var(--border);
            border-radius: var(--radius-sm);
            color: var(--muted);
            font-family: var(--font-mono);
            font-size: 0.82rem;
            line-height: 1.5;
          }

          @media (prefers-reduced-motion: reduce) {
            .wallet-select-backdrop,
            .wallet-select-card {
              animation: none;
            }
          }
        `}
      </style>

      <div
        aria-label="Connect Wallet"
        aria-modal="true"
        className="wallet-select-card"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="wallet-select-header">
          <h2>Connect Wallet</h2>
          <button
            aria-label="Close wallet selection"
            className="wallet-select-close"
            type="button"
            onClick={onClose}
          >
            x
          </button>
        </div>

        <div className="wallet-select-list">
          {filteredConnectors.length > 0 ? (
            filteredConnectors.map((connector) => {
              const connectorIcon = getConnectorIcon(connector);

              return (
                <button
                  key={`${connector.id}-${connector.name}`}
                  className="wallet-select-row"
                  disabled={isPending}
                  type="button"
                  onClick={() => onConnect(connector)}
                >
                  <span className="wallet-select-row-main">
                    {connectorIcon ? (
                      <img
                        alt=""
                        aria-hidden="true"
                        className="wallet-select-icon"
                        height={32}
                        src={connectorIcon}
                        width={32}
                      />
                    ) : (
                      <span className="wallet-select-mark" aria-hidden="true">
                        {getConnectorMark(connector)}
                      </span>
                    )}
                    <span className="wallet-select-name">
                      {getConnectorLabel(connector)}
                    </span>
                  </span>
                  {isWalletConnectConnector(connector) ? (
                    <span className="wallet-select-hint">Scan QR</span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="wallet-select-empty">
              No wallet connector is available in this browser.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
