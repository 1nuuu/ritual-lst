"use client";

import { useEffect } from "react";
import type { Connector } from "wagmi";

const WALLETCONNECT_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 185'%3E%3Cpath fill='%233B99FC' d='M61.4 36.9c48.9-47.9 128.3-47.9 177.2 0l5.9 5.8a6.1 6.1 0 0 1 0 8.7l-20.1 19.7a3.2 3.2 0 0 1-4.4 0l-8.1-7.9c-34.1-33.4-89.4-33.4-123.5 0l-8.7 8.5a3.2 3.2 0 0 1-4.4 0L54.2 51.9a6.1 6.1 0 0 1 0-8.7l7.2-6.3zm218.7 40.8 17.9 17.5a6.1 6.1 0 0 1 0 8.7l-80.7 79.1a6.3 6.3 0 0 1-8.9 0l-57.3-56.1a1.6 1.6 0 0 0-2.2 0l-57.3 56.1a6.3 6.3 0 0 1-8.9 0L1.9 104a6.1 6.1 0 0 1 0-8.7l17.9-17.5a6.3 6.3 0 0 1 8.9 0l57.3 56.1a1.6 1.6 0 0 0 2.2 0l57.3-56.1a6.3 6.3 0 0 1 8.9 0l57.3 56.1a1.6 1.6 0 0 0 2.2 0l57.3-56.1a6.3 6.3 0 0 1 8.9 0z'/%3E%3C/svg%3E";

const COINBASE_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 1024'%3E%3Crect width='1024' height='1024' rx='200' fill='%231652F0'/%3E%3Cpath fill='white' d='M512 692c-99.4 0-180-80.6-180-180s80.6-180 180-180c89.6 0 164.2 65.6 177.4 151.6H868C853.6 331.6 696.6 204 512 204 308.2 204 144 368.2 144 572s164.2 368 368 368c184.6 0 341.6-127.6 356-323.6H689.4C676.2 702.4 601.6 692 512 692z'/%3E%3C/svg%3E";

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
  if (connector.icon) return connector.icon;
  if (connector.id === "walletConnect") return WALLETCONNECT_ICON;
  if (
    connector.id === "coinbaseWalletSDK" ||
    connector.id === "coinbaseWallet"
  ) {
    return COINBASE_ICON;
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
