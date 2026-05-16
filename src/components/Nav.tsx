"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";

const navLinks = [
  { label: "Assistant", href: "/assistant" },
  { label: "Stake", href: "/stake" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Docs", href: "/docs" },
] as const;

export function Nav() {
  const [isLight, setIsLight] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
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

      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(event.target as Node)
      ) {
        setMobileNavOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWalletOpen(false);
        setMobileNavOpen(false);
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
  }, [pathname]);

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const activeNavLink = navLinks.find((item) => item.href === pathname);
  const mobileNavLabel = activeNavLink?.label ?? "Menu";

  return (
    <nav className="site-nav" aria-label="Primary navigation">
      <div className="nav-shell">
        <Link className="logo nav-logo" href="/">
          Ritual Staking
        </Link>

        <div className="nav-center" aria-label="Main sections">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;

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
                    <div className="wallet-dropdown-label">
                      Connected wallet
                    </div>
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
  );
}
