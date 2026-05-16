"use client";

import { useMemo } from "react";
import { formatEther, type Address } from "viem";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { config } from "@/lib/config";
import { useLeaderboard } from "@/lib/hooks/useLeaderboard";

const skeletonRows = [1, 2, 3, 4, 5] as const;

const formatTokenAmount = (value: bigint) => {
  const formatted = formatEther(value);
  const [whole, decimals = ""] = formatted.split(".");
  const trimmedDecimals = decimals.slice(0, 4).replace(/0+$/, "");

  return trimmedDecimals ? `${whole}.${trimmedDecimals}` : whole;
};

const truncateAddress = (address: Address) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const formatTimestamp = (date: Date | null) => {
  if (!date) {
    return "Pending";
  }

  return date.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
};

const formatRelativeTimestamp = (date: Date | null) => {
  if (!date) {
    return "Last updated pending";
  }

  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (elapsedMinutes === 0) {
    return "Last updated just now";
  }

  if (elapsedMinutes === 1) {
    return "Last updated 1 minute ago";
  }

  return `Last updated ${elapsedMinutes} minutes ago`;
};

const getRankClassName = (rank: number) => {
  if (rank === 1) {
    return "leaderboard-rank leaderboard-rank--gold";
  }

  if (rank === 2) {
    return "leaderboard-rank leaderboard-rank--silver";
  }

  if (rank === 3) {
    return "leaderboard-rank leaderboard-rank--bronze";
  }

  return "leaderboard-rank";
};

export default function LeaderboardPage() {
  const { leaderboard, isLoading, lastUpdated, error, refetch } =
    useLeaderboard();

  const totalVolumeStaked = useMemo(
    () =>
      leaderboard.reduce(
        (total, entry) => total + entry.totalVolumeStaked,
        BigInt(0),
      ),
    [leaderboard],
  );

  return (
    <>
      <Nav />
      <main className="feature-page leaderboard-page">
        <div className="feature-page-shell">
          <header className="leaderboard-header">
            <div>
              <span className="feature-kicker">Ritual Testnet</span>
              <h1 className="feature-title">Leaderboard</h1>
              <p className="feature-subtitle">
                Top stakers by volume on Ritual Testnet
              </p>
            </div>

            <div className="leaderboard-actions">
              <button
                className="leaderboard-refresh"
                disabled={isLoading}
                type="button"
                onClick={refetch}
              >
                {isLoading ? "Refreshing" : "Refresh"}
              </button>
            </div>
          </header>

          <section className="leaderboard-stats" aria-label="Leaderboard stats">
            <article className="leaderboard-stat">
              <span>Total Unique Stakers</span>
              <strong>{leaderboard.length}</strong>
            </article>
            <article className="leaderboard-stat">
              <span>Total Volume Staked</span>
              <strong>
                {formatTokenAmount(totalVolumeStaked)} {config.tokenSymbol}
              </strong>
            </article>
            <article className="leaderboard-stat">
              <span>Last Updated</span>
              <strong>{formatTimestamp(lastUpdated)}</strong>
            </article>
          </section>

          {error ? (
            <div className="leaderboard-error" role="alert">
              <strong>Leaderboard data unavailable</strong>
              <span>{error}</span>
            </div>
          ) : null}

          <section className="leaderboard-table-card" aria-label="Staker rankings">
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Address</th>
                    <th scope="col">Total Staked</th>
                    <th scope="col">Active xRITUAL</th>
                    <th scope="col">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    skeletonRows.map((row) => (
                      <tr key={row}>
                        <td>
                          <span className="leaderboard-skeleton" />
                        </td>
                        <td>
                          <span className="leaderboard-skeleton" />
                        </td>
                        <td>
                          <span className="leaderboard-skeleton" />
                        </td>
                        <td>
                          <span className="leaderboard-skeleton" />
                        </td>
                        <td>
                          <span className="leaderboard-skeleton" />
                        </td>
                      </tr>
                    ))
                  ) : error ? (
                    <tr>
                      <td className="leaderboard-message-cell" colSpan={5}>
                        <div className="leaderboard-empty">
                          Retry the leaderboard request when Ritual RPC is
                          available.
                        </div>
                      </td>
                    </tr>
                  ) : leaderboard.length > 0 ? (
                    leaderboard.map((entry) => (
                      <tr key={entry.address}>
                        <td>
                          <span className={getRankClassName(entry.rank)}>
                            #{entry.rank}
                          </span>
                        </td>
                        <td>
                          <span className="leaderboard-address">
                            {truncateAddress(entry.address)}
                          </span>
                        </td>
                        <td>
                          {formatTokenAmount(entry.totalVolumeStaked)}{" "}
                          <span className="leaderboard-muted">
                            {config.tokenSymbol}
                          </span>
                        </td>
                        <td>
                          {formatTokenAmount(entry.currentActiveStake)}{" "}
                          <span className="leaderboard-muted">
                            {config.lstSymbol}
                          </span>
                        </td>
                        <td>{entry.stakedCount}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="leaderboard-message-cell" colSpan={5}>
                        <div className="leaderboard-empty">
                          No stakers yet. Be the first to stake.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="leaderboard-footnote">
              {formatRelativeTimestamp(lastUpdated)}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
