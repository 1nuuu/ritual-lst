"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { formatEther } from "viem";
import type { Connector } from "wagmi";
import {
  useAccount,
  useBalance,
  useConnect,
  useConnectorClient,
  useDisconnect,
  useReadContract,
} from "wagmi";
import { WalletSelectModal } from "@/components/WalletSelectModal";
import { ritualChain } from "@/lib/chain";
import { config } from "@/lib/config";
import type { ContractVersion } from "@/lib/contracts";
import { XRITUAL_CONTRACT, xRitualAbi } from "@/lib/xritual";

const navLinks = [
  { label: "Assistant", href: "/assistant" },
  { label: "Stake", href: "/stake" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Docs", href: "/docs" },
] as const;

const stakeVersionOptions: Array<{
  label: string;
  badge: string;
  version: ContractVersion;
}> = [
  { label: "V2 (new)", badge: "Public", version: "v2" },
  { label: "V1 (old)", badge: "SBT only", version: "v1" },
];

const formatBalance = (value: bigint | undefined) => {
  if (value === undefined) {
    return "0";
  }

  const [whole, fraction = ""] = formatEther(value).split(".");
  const trimmedFraction = fraction.slice(0, 4).replace(/0+$/, "");

  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
};

export function Nav() {
  const [isLight, setIsLight] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [stakeMenuOpen, setStakeMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const stakeMenuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { data: connectorClient } = useConnectorClient({
    chainId: ritualChain.id,
  });
  const { disconnect } = useDisconnect();
  const nativeBalance = useBalance({
    address,
    chainId: ritualChain.id,
  });
  const xRitualBalance = useReadContract({
    address: XRITUAL_CONTRACT,
    abi: xRitualAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && XRITUAL_CONTRACT) },
  });

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

      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(event.target as Node)
      ) {
        setMobileNavOpen(false);
      }

      if (
        stakeMenuRef.current &&
        !stakeMenuRef.current.contains(event.target as Node)
      ) {
        setStakeMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWalletOpen(false);
        setMobileNavOpen(false);
        setStakeMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
    setStakeMenuOpen(false);
  }, [pathname]);

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const activeNavLink = navLinks.find((item) => item.href === pathname);
  const getVersionFromLocation = () => {
    if (typeof window === "undefined") {
      return "v2" as ContractVersion;
    }

    return new URLSearchParams(window.location.search).get("version") === "v1"
      ? "v1"
      : "v2";
  };
  const [stakeVersion, setStakeVersion] =
    useState<ContractVersion>(getVersionFromLocation);
  const stakeVersionLabel = stakeVersion === "v2" ? "V2 (new)" : "V1 (old)";
  const mobileNavLabel =
    pathname === "/stake"
      ? `Stake ${stakeVersionLabel}`
      : activeNavLink?.label ?? "Menu";
  const ritualBalanceLabel = formatBalance(nativeBalance.data?.value);
  const xRitualBalanceLabel = formatBalance(xRitualBalance.data);

  useEffect(() => {
    const syncStakeVersion = (event?: Event) => {
      const nextVersion = (event as CustomEvent<ContractVersion> | undefined)
        ?.detail;

      if (nextVersion === "v1" || nextVersion === "v2") {
        setStakeVersion(nextVersion);
        return;
      }

      setStakeVersion(getVersionFromLocation());
    };

    syncStakeVersion();
    window.addEventListener("popstate", syncStakeVersion);
    window.addEventListener("ritual-stake-version-change", syncStakeVersion);

    return () => {
      window.removeEventListener("popstate", syncStakeVersion);
      window.removeEventListener(
        "ritual-stake-version-change",
        syncStakeVersion,
      );
    };
  }, [pathname]);

  const handleStakeVersionSelect = (version: ContractVersion) => {
    setStakeVersion(version);
    setStakeMenuOpen(false);
    setMobileNavOpen(false);
    window.dispatchEvent(
      new CustomEvent<ContractVersion>("ritual-stake-version-change", {
        detail: version,
      }),
    );
    router.push(`/stake?version=${version}`);
  };

  const handleWalletSelect = (connector: Connector) => {
    setShowWalletModal(false);
    connect({ connector });
  };

  const handleCopyAddress = async () => {
    if (!address) {
      return;
    }

    await navigator.clipboard.writeText(address);
  };

  const addXRitualToWallet = async () => {
    if (!XRITUAL_CONTRACT) {
      return;
    }

    try {
      const watchAssetRequest = {
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: XRITUAL_CONTRACT,
            symbol: config.lstSymbol,
            decimals: 18,
          },
        },
      } as const;

      if (connectorClient?.transport?.request) {
        await (
          connectorClient.transport.request as (
            args: typeof watchAssetRequest,
          ) => Promise<unknown>
        )(watchAssetRequest);
        return;
      }

      const provider = (window as Window & {
        ethereum?: { request: (args: unknown) => Promise<unknown> };
      }).ethereum;

      if (provider) {
        await provider.request(watchAssetRequest);
        return;
      }
    } catch {
      return;
    }
  };

  return (
    <>
      <nav className="site-nav" aria-label="Primary navigation">
        <div className="nav-shell">
          <Link className="logo nav-logo" href="/">
            Ritual Staking
          </Link>

          <div className="nav-center" aria-label="Main sections">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;

              if (item.href === "/stake") {
                return (
                  <div
                    className="nav-stake-menu"
                    key={item.href}
                    ref={stakeMenuRef}
                  >
                    <button
                      className={`nav-link nav-stake-trigger ${
                        isActive ? "active" : ""
                      }`}
                      type="button"
                      aria-current={isActive ? "page" : undefined}
                      aria-expanded={stakeMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setStakeMenuOpen((open) => !open)}
                    >
                      <span>{item.label}</span>
                      <span className="nav-stake-version">
                        {stakeVersionLabel}
                      </span>
                      <span
                        className={`nav-stake-caret ${
                          stakeMenuOpen ? "open" : ""
                        }`}
                        aria-hidden="true"
                      >
                        v
                      </span>
                    </button>

                    {stakeMenuOpen ? (
                      <div
                        className="nav-stake-dropdown"
                        role="menu"
                        aria-label="Stake version"
                      >
                        {stakeVersionOptions.map((option) => (
                          <button
                            className={`nav-stake-option ${
                              stakeVersion === option.version ? "active" : ""
                            }`}
                            key={option.version}
                            type="button"
                            role="menuitem"
                            onPointerDown={(event) => {
                              event.preventDefault();
                              handleStakeVersionSelect(option.version);
                            }}
                            onClick={() =>
                              handleStakeVersionSelect(option.version)
                            }
                          >
                            <span>{option.label}</span>
                            <span
                              className={`nav-version-badge ${
                                option.version === "v1" ? "legacy" : ""
                              }`}
                            >
                              {option.badge}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  className={`nav-link ${isActive ? "active" : ""}`}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

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
                      <div className="wallet-dropdown-address-row">
                        <span className="wallet-dropdown-address">
                          {truncate(address!)}
                        </span>
                        <span className="wallet-caret">v</span>
                      </div>

                      <div className="wallet-balance-list">
                        <div className="wallet-balance-row">
                          <span className="wallet-balance-token">
                            <span
                              className="wallet-token-dot wallet-token-dot--ritual"
                              aria-hidden="true"
                            />
                            <span className="wallet-balance-amount">
                              {ritualBalanceLabel}
                            </span>
                          </span>
                          <span className="wallet-balance-symbol">
                            {config.tokenSymbol}
                          </span>
                        </div>
                        <div className="wallet-balance-row">
                          <span className="wallet-balance-token">
                            <span
                              className="wallet-token-dot wallet-token-dot--xritual"
                              aria-hidden="true"
                            />
                            <span className="wallet-balance-amount">
                              {xRitualBalanceLabel}
                            </span>
                          </span>
                          <span className="wallet-balance-symbol">
                            {config.lstSymbol}
                          </span>
                        </div>
                      </div>

                      <div className="wallet-dropdown-actions">
                        {XRITUAL_CONTRACT ? (
                          <button
                            className="wallet-dropdown-action"
                            role="menuitem"
                            type="button"
                            onClick={addXRitualToWallet}
                          >
                            <span aria-hidden="true">+</span>
                            <span>Add {config.lstSymbol} to Wallet</span>
                          </button>
                        ) : null}
                        <button
                          className="wallet-dropdown-action"
                          role="menuitem"
                          type="button"
                          onClick={handleCopyAddress}
                        >
                          <span aria-hidden="true">⧉</span>
                          <span>Copy Address</span>
                        </button>
                        <button
                          className="wallet-dropdown-action wallet-dropdown-action--disconnect"
                          role="menuitem"
                          type="button"
                          onClick={() => {
                            setWalletOpen(false);
                            disconnect();
                          }}
                        >
                          <span aria-hidden="true">-&gt;</span>
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="wallet-btn"
                  onClick={() => setShowWalletModal(true)}
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

          <div className="mobile-nav" ref={mobileNavRef}>
            <button
              className="mobile-nav-toggle"
              type="button"
              aria-expanded={mobileNavOpen}
              aria-haspopup="menu"
              aria-label={`Toggle navigation menu. Current page: ${mobileNavLabel}`}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <span>{mobileNavLabel}</span>
              <span
                className={`mobile-nav-chevron ${
                  mobileNavOpen ? "mobile-nav-chevron--open" : ""
                }`}
                aria-hidden="true"
              >
                v
              </span>
            </button>

            {mobileNavOpen ? (
              <div className="mobile-nav-dropdown" role="menu">
                {navLinks.map((item) => {
                  const isActive = pathname === item.href;

                  if (item.href === "/stake") {
                    return stakeVersionOptions.map((option) => (
                      <button
                        key={`${item.href}-${option.version}`}
                        className={`mobile-nav-option ${
                          isActive && stakeVersion === option.version
                            ? "active"
                            : ""
                        }`}
                        type="button"
                        role="menuitem"
                        aria-current={
                          isActive && stakeVersion === option.version
                            ? "page"
                            : undefined
                        }
                        onPointerDown={(event) => {
                          event.preventDefault();
                          handleStakeVersionSelect(option.version);
                        }}
                        onClick={() =>
                          handleStakeVersionSelect(option.version)
                        }
                      >
                      <span>Stake {option.label}</span>
                        <span
                          className={`nav-version-badge ${
                            option.version === "v1" ? "legacy" : ""
                          }`}
                        >
                          {option.badge}
                        </span>
                      </button>
                    ));
                  }

                  return (
                    <Link
                      key={item.href}
                      className={`mobile-nav-option ${
                        isActive ? "active" : ""
                      }`}
                      href={item.href}
                      role="menuitem"
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setMobileNavOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </nav>
      <WalletSelectModal
        connectors={connectors}
        isOpen={showWalletModal}
        isPending={isConnectPending}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletSelect}
      />
    </>
  );
}
