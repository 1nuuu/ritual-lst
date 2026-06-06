"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { decodeFunctionResult, encodeFunctionData } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { ritualChain } from "@/lib/chain";
import { puffSbtAbi, SBT_CONTRACT } from "@/lib/sbt";

type ApiLeaderboardRow = {
  address: string;
  total_points: number | string;
  staked_amount: number | string;
  sbt_bonus_given: boolean;
  rank: number | string | null;
};

type ApiStakeHistoryPoint = {
  month: string;
  total_staked: number | string;
};

type LeaderboardRow = {
  address: string;
  totalPoints: number;
  stakedAmount: number;
  sbtBonusGiven: boolean;
  rank: number | null;
};

type StakeHistoryPoint = {
  month: string;
  totalStaked: number;
};

type LeaderboardResponse = {
  board?: ApiLeaderboardRow[];
  userRank?: ApiLeaderboardRow | null;
  summary?: {
    totalStaked?: number | string | null;
    uniqueWallets?: number | string | null;
  };
  stakeHistory?: ApiStakeHistoryPoint[];
  error?: string;
};

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);
const LEADERBOARD_REFRESH_INTERVAL_MS = 10_000;

const shortenAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

const formatTokenSerial = (value: bigint | number | string | null) =>
  value === null ? null : `#${value.toString().padStart(3, "0")}`;

const formatMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
};

type RpcBatchResult = {
  id: number;
  result?: `0x${string}`;
  error?: unknown;
};

const loadSbtSerialsWithRpcBatch = async (
  holderAddresses: string[],
  sbtContract: `0x${string}`,
) => {
  const rpcUrl = ritualChain.rpcUrls.default.http[0];
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      holderAddresses.map((holderAddress, index) => ({
        jsonrpc: "2.0",
        id: index + 1,
        method: "eth_call",
        params: [
          {
            to: sbtContract,
            data: encodeFunctionData({
              abi: puffSbtAbi,
              functionName: "addressToTokenId",
              args: [holderAddress as `0x${string}`],
            }),
          },
          "latest",
        ],
      })),
    ),
  });

  if (!response.ok) {
    throw new Error("Unable to load SBT serials.");
  }

  const results = (await response.json()) as RpcBatchResult[];
  const serialMap: Record<string, string> = {};

  results.forEach((result) => {
    if (result.error || !result.result) return;

    const holderIndex = result.id - 1;
    const holderAddress = holderAddresses[holderIndex];
    if (!holderAddress) return;

    const tokenId = decodeFunctionResult({
      abi: puffSbtAbi,
      functionName: "addressToTokenId",
      data: result.result,
    }) as bigint;
    const serial = formatTokenSerial(tokenId);

    if (serial) {
      serialMap[holderAddress] = serial;
    }
  });

  return serialMap;
};

const normalizeRow = (row: ApiLeaderboardRow): LeaderboardRow => ({
  address: row.address,
  totalPoints: Number(row.total_points),
  stakedAmount: Number(row.staked_amount),
  sbtBonusGiven: Boolean(row.sbt_bonus_given),
  rank: row.rank === null ? null : Number(row.rank),
});

const normalizeStakeHistoryPoint = (
  point: ApiStakeHistoryPoint,
): StakeHistoryPoint => ({
  month: point.month,
  totalStaked: Number(point.total_staked),
});

const formatPoints = (points: number) =>
  `${points.toLocaleString(undefined, {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })} pts`;

const formatStakedAmount = (amount: number) =>
  `${amount.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} RITUAL`;

const formatCount = (count: number) =>
  count.toLocaleString(undefined, { maximumFractionDigits: 0 });

const getRankClassName = (rank: number | null) => {
  if (rank === 1) return "leaderboard-rank leaderboard-rank--gold";
  if (rank === 2) return "leaderboard-rank leaderboard-rank--silver";
  if (rank === 3) return "leaderboard-rank leaderboard-rank--bronze";
  return "leaderboard-rank";
};

function HolderBadge({ serial }: { serial: string | null }) {
  return (
    <span
      className={`leaderboard-sbt-badge ${
        serial ? "leaderboard-sbt-badge--active" : ""
      }`}
    >
      {serial ?? "No SBT"}
    </span>
  );
}

function TotalStakedGrowthChart({
  points,
  totalStaked,
}: {
  points: StakeHistoryPoint[];
  totalStaked: number;
}) {
  const chartPoints = points.slice(-12);
  const hasData = chartPoints.length > 0;
  const width = 720;
  const height = 230;
  const padding = { top: 18, right: 24, bottom: 34, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const bottom = height - padding.bottom;
  const observedMaxValue = Math.max(
    0,
    ...chartPoints.map((point) => point.totalStaked),
  );
  const maxValue = observedMaxValue > 0 ? observedMaxValue : 1;
  const axisMaximumFractionDigits = maxValue < 1 ? 4 : 2;

  const coordinates = chartPoints.map((point, index) => {
    const x =
      chartPoints.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (chartPoints.length - 1)) * plotWidth;
    const y =
      padding.top + plotHeight - (point.totalStaked / maxValue) * plotHeight;
    return { ...point, x, y };
  });

  const lineCoordinates =
    coordinates.length === 1
      ? [
          { ...coordinates[0], x: padding.left },
          { ...coordinates[0], x: padding.left + plotWidth },
        ]
      : coordinates;
  const linePath = lineCoordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = lineCoordinates.length
    ? `${linePath} L ${lineCoordinates[lineCoordinates.length - 1].x} ${bottom} L ${lineCoordinates[0].x} ${bottom} Z`
    : "";
  const gridLines = [1, 0.5, 0].map((ratio) => {
    const y = padding.top + plotHeight * ratio;
    const value = maxValue * (1 - ratio);
    return { y, value };
  });

  return (
    <section className="leaderboard-chart-card" aria-label="Total staked">
      <div className="leaderboard-chart-header">
        <span>Total Staked</span>
        <strong>{formatStakedAmount(totalStaked)}</strong>
      </div>

      {hasData ? (
        <div
          className="leaderboard-chart"
          role="img"
          aria-label="Monthly total staked growth"
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <title>Total staked growth by month</title>
            <defs>
              <linearGradient id="stakeGrowthLine" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--green)" />
                <stop offset="100%" stopColor="var(--lime)" />
              </linearGradient>
              <linearGradient id="stakeGrowthArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(25, 209, 132, 0.28)" />
                <stop offset="100%" stopColor="rgba(25, 209, 132, 0)" />
              </linearGradient>
            </defs>

            {gridLines.map((line) => (
              <g key={line.y}>
                <line
                  className="leaderboard-chart-grid"
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={line.y}
                  y2={line.y}
                />
                <text
                  className="leaderboard-chart-y"
                  x={padding.left - 10}
                  y={line.y + 4}
                  textAnchor="end"
                >
                  {line.value.toLocaleString(undefined, {
                    maximumFractionDigits: axisMaximumFractionDigits,
                  })}
                </text>
              </g>
            ))}

            <path className="leaderboard-chart-area" d={areaPath} />
            <path className="leaderboard-chart-line" d={linePath} />

            {coordinates.map((point) => (
              <circle
                key={point.month}
                className="leaderboard-chart-dot"
                cx={point.x}
                cy={point.y}
                r="4"
              />
            ))}

            {coordinates.map((point, index) =>
              chartPoints.length <= 6 ||
              index === 0 ||
              index === coordinates.length - 1 ? (
                <text
                  key={point.month}
                  className="leaderboard-chart-x"
                  x={point.x}
                  y={height - 8}
                  textAnchor="middle"
                >
                  {formatMonthLabel(point.month)}
                </text>
              ) : null,
            )}
          </svg>
        </div>
      ) : (
        <div className="leaderboard-chart-empty">No staking history yet</div>
      )}
    </section>
  );
}

export default function LeaderboardPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: ritualChain.id });
  const isRequestInFlightRef = useRef(false);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sbtSerials, setSbtSerials] = useState<Record<string, string>>({});
  const [stakeHistory, setStakeHistory] = useState<StakeHistoryPoint[]>([]);
  const [summaryTotalStaked, setSummaryTotalStaked] = useState<number | null>(
    null,
  );
  const [summaryUniqueWallets, setSummaryUniqueWallets] = useState<
    number | null
  >(null);

  const loadLeaderboard = useCallback(async (showLoading = true) => {
    if (isRequestInFlightRef.current) {
      return;
    }

    const params = new URLSearchParams({ limit: "100" });
    if (address) {
      params.set("address", address.toLowerCase());
    }

    isRequestInFlightRef.current = true;
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/leaderboard?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as LeaderboardResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load leaderboard.");
      }

      setBoard((data.board ?? []).map((row) => normalizeRow(row)));
      setUserRank(data.userRank ? normalizeRow(data.userRank) : null);
      setStakeHistory(
        (data.stakeHistory ?? []).map((point) =>
          normalizeStakeHistoryPoint(point),
        ),
      );
      setSummaryTotalStaked(
        data.summary?.totalStaked === null ||
          data.summary?.totalStaked === undefined
          ? null
          : Number(data.summary.totalStaked),
      );
      setSummaryUniqueWallets(
        data.summary?.uniqueWallets === null ||
          data.summary?.uniqueWallets === undefined
          ? null
          : Number(data.summary.uniqueWallets),
      );
    } catch (err) {
      setBoard([]);
      setUserRank(null);
      setStakeHistory([]);
      setSummaryTotalStaked(null);
      setSummaryUniqueWallets(null);
      setError(
        err instanceof Error ? err.message : "Unable to load leaderboard.",
      );
    } finally {
      isRequestInFlightRef.current = false;
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [address]);

  useEffect(() => {
    void loadLeaderboard();
    const interval = window.setInterval(
      () => void loadLeaderboard(false),
      LEADERBOARD_REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [loadLeaderboard]);

  useEffect(() => {
    const holderAddresses = board
      .filter((entry) => entry.sbtBonusGiven)
      .map((entry) => entry.address.toLowerCase());

    if (!publicClient || !SBT_CONTRACT || holderAddresses.length === 0) {
      setSbtSerials({});
      return;
    }

    const sbtContract = SBT_CONTRACT;
    let cancelled = false;

    const loadSbtSerials = async () => {
      const contracts = holderAddresses.map((holderAddress) => ({
        address: sbtContract,
        abi: puffSbtAbi,
        functionName: "addressToTokenId" as const,
        args: [holderAddress as `0x${string}`],
      }));

      try {
        const results = await publicClient.multicall({
          contracts,
          allowFailure: true,
        });

        if (cancelled) return;

        const serialMap: Record<string, string> = {};
        results.forEach((result, index) => {
          if (result.status === "success" && result.result) {
            const serial = formatTokenSerial(result.result as bigint);
            if (serial) {
              serialMap[holderAddresses[index]] = serial;
            }
          }
        });

        setSbtSerials(serialMap);
      } catch {
        const serialMap = await loadSbtSerialsWithRpcBatch(
          holderAddresses,
          sbtContract,
        );

        if (!cancelled) {
          setSbtSerials(serialMap);
        }
      }
    };

    void loadSbtSerials();

    return () => {
      cancelled = true;
    };
  }, [board, publicClient]);

  const totalStaked = useMemo(
    () => board.reduce((sum, entry) => sum + entry.stakedAmount, 0),
    [board],
  );
  const displayedTotalStaked = summaryTotalStaked ?? totalStaked;
  const uniqueWallets = summaryUniqueWallets ?? board.length;
  const userPoints = userRank?.totalPoints ?? 0;

  return (
    <>
      <Nav />
      <main className="feature-page leaderboard-page">
        <div className="feature-page-shell">
          <header className="leaderboard-header">
            <div>
              <span className="feature-kicker">Ritual Testnet</span>
              <h1 className="feature-title">Leaderboard</h1>
            </div>

            <div className="leaderboard-actions">
              <button
                className="leaderboard-refresh"
                type="button"
                disabled={isLoading}
                onClick={() => void loadLeaderboard(true)}
              >
                {isLoading ? "Loading" : "Refresh"}
              </button>
            </div>
          </header>

          <section className="leaderboard-stats" aria-label="Leaderboard stats">
            <div className="leaderboard-stat">
              <span>Your Rank</span>
              <strong>
                {address
                  ? userRank?.rank
                    ? `#${userRank.rank}`
                    : "No rank"
                  : "Connect"}
              </strong>
            </div>
            <div className="leaderboard-stat">
              <span>Your Points</span>
              <strong>{formatPoints(userPoints)}</strong>
            </div>
            <div className="leaderboard-stat">
              <span>Unique Wallets</span>
              <strong>{formatCount(uniqueWallets)}</strong>
            </div>
          </section>

          <TotalStakedGrowthChart
            points={stakeHistory}
            totalStaked={displayedTotalStaked}
          />

          {error ? (
            <div className="leaderboard-error" role="status">
              <strong>Leaderboard unavailable</strong>
              <span>{error}</span>
            </div>
          ) : null}

          <section className="leaderboard-table-card" aria-label="Top 100">
            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Wallet</th>
                    <th>SBT Holder</th>
                    <th>Staked</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? skeletonRows.map((row) => (
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
                    : null}

                  {!isLoading && board.length > 0
                    ? board.map((entry) => (
                        <tr key={entry.address}>
                          <td>
                            <span className={getRankClassName(entry.rank)}>
                              {entry.rank ? `#${entry.rank}` : "-"}
                            </span>
                          </td>
                          <td>
                            <span className="leaderboard-address">
                              {shortenAddress(entry.address)}
                            </span>
                          </td>
                          <td>
                            <HolderBadge
                              serial={
                                sbtSerials[entry.address.toLowerCase()] ?? null
                              }
                            />
                          </td>
                          <td className="leaderboard-muted">
                            {formatStakedAmount(entry.stakedAmount)}
                          </td>
                          <td>{formatPoints(entry.totalPoints)}</td>
                        </tr>
                      ))
                    : null}

                  {!isLoading && board.length === 0 ? (
                    <tr>
                      <td className="leaderboard-message-cell" colSpan={5}>
                        <div className="leaderboard-empty">
                          No stakes recorded yet
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
