"use client";

import { useCallback, useEffect, useState } from "react";
import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { ritualChain } from "@/lib/chain";
import { STAKING_POOL_CONTRACT } from "@/lib/staking";

const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const MAX_LOG_BLOCK_RANGE = BigInt(100000);
const ONE_BLOCK = BigInt(1);
const DEFAULT_DEPLOYMENT_BLOCK = BigInt(19046599);

const stakedEvent = parseAbiItem(
  "event Staked(address indexed user, uint256 ritualAmount, uint256 xRitualMinted)",
);

const unstakeRequestedEvent = parseAbiItem(
  "event UnstakeRequested(address indexed user, uint256 amount, uint256 claimBlock)",
);

const unstakeClaimedEvent = parseAbiItem(
  "event UnstakeClaimed(address indexed user, uint256 amount)",
);

const balanceOfAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const publicClient = createPublicClient({
  chain: ritualChain,
  transport: http(),
});

export type LeaderboardEntry = {
  rank: number;
  address: Address;
  totalVolumeStaked: bigint;
  currentActiveStake: bigint;
  stakedCount: number;
};

type StakerStats = {
  address: Address;
  totalVolumeStaked: bigint;
  stakedCount: number;
};

type UseLeaderboardResult = {
  leaderboard: LeaderboardEntry[];
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
  refetch: () => void;
};

const compareBigIntDesc = (left: bigint, right: bigint) => {
  if (left === right) {
    return 0;
  }

  return left > right ? -1 : 1;
};

const normalizeAddressKey = (address: Address) => address.toLowerCase();

const getDeploymentBlock = () => {
  const configuredBlock =
    process.env.NEXT_PUBLIC_STAKING_POOL_DEPLOYMENT_BLOCK?.trim();

  if (!configuredBlock) {
    return DEFAULT_DEPLOYMENT_BLOCK;
  }

  if (!/^\d+$/.test(configuredBlock)) {
    console.warn(
      "NEXT_PUBLIC_STAKING_POOL_DEPLOYMENT_BLOCK must be a positive integer. Falling back to default deployment block.",
    );
    return DEFAULT_DEPLOYMENT_BLOCK;
  }

  return BigInt(configuredBlock);
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unable to load leaderboard from Ritual RPC.";
};

const getLogRanges = (fromBlock: bigint, toBlock: bigint) => {
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];

  if (toBlock < fromBlock) {
    return ranges;
  }

  let rangeStart = fromBlock;

  while (rangeStart <= toBlock) {
    const rangeEndCandidate = rangeStart + MAX_LOG_BLOCK_RANGE - ONE_BLOCK;
    const rangeEnd = rangeEndCandidate < toBlock ? rangeEndCandidate : toBlock;

    ranges.push({
      fromBlock: rangeStart,
      toBlock: rangeEnd,
    });

    rangeStart = rangeEnd + ONE_BLOCK;
  }

  return ranges;
};

export function useLeaderboard(): UseLeaderboardResult {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    const loadLeaderboard = async () => {
      const contractAddress = STAKING_POOL_CONTRACT;

      if (!contractAddress) {
        setLeaderboard([]);
        setError("Staking pool contract is not configured.");
        setLastUpdated(new Date());
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = getDeploymentBlock();
        const logRanges = getLogRanges(fromBlock, latestBlock);
        const logsByRange = await Promise.all(
          logRanges.map((range) =>
            Promise.all([
              publicClient.getLogs({
                address: contractAddress,
                event: stakedEvent,
                fromBlock: range.fromBlock,
                toBlock: range.toBlock,
              }),
              publicClient.getLogs({
                address: contractAddress,
                event: unstakeRequestedEvent,
                fromBlock: range.fromBlock,
                toBlock: range.toBlock,
              }),
              publicClient.getLogs({
                address: contractAddress,
                event: unstakeClaimedEvent,
                fromBlock: range.fromBlock,
                toBlock: range.toBlock,
              }),
            ]),
          ),
        );

        const stakedLogs = logsByRange.flatMap(([logs]) => logs);
        const unstakeRequestedLogs = logsByRange.flatMap(([, logs]) => logs);
        const unstakeClaimedLogs = logsByRange.flatMap(([, , logs]) => logs);

        const stakers = new Map<string, StakerStats>();

        for (const log of stakedLogs) {
          const user = log.args.user;
          const ritualAmount = log.args.ritualAmount;

          if (!user || ritualAmount === undefined) {
            continue;
          }

          const key = normalizeAddressKey(user);
          const current = stakers.get(key);

          if (current) {
            current.totalVolumeStaked += ritualAmount;
            current.stakedCount += 1;
          } else {
            stakers.set(key, {
              address: user,
              totalVolumeStaked: ritualAmount,
              stakedCount: 1,
            });
          }
        }

        for (const log of unstakeRequestedLogs) {
          const user = log.args.user;

          if (!user) {
            continue;
          }

          const key = normalizeAddressKey(user);

          if (!stakers.has(key)) {
            stakers.set(key, {
              address: user,
              totalVolumeStaked: BigInt(0),
              stakedCount: 0,
            });
          }
        }

        for (const log of unstakeClaimedLogs) {
          const user = log.args.user;

          if (!user) {
            continue;
          }

          const key = normalizeAddressKey(user);

          if (!stakers.has(key)) {
            stakers.set(key, {
              address: user,
              totalVolumeStaked: BigInt(0),
              stakedCount: 0,
            });
          }
        }

        const entries = await Promise.all(
          Array.from(stakers.values()).map(async (staker) => {
            const currentActiveStake = await publicClient.readContract({
              address: contractAddress,
              abi: balanceOfAbi,
              functionName: "balanceOf",
              args: [staker.address],
            });

            return {
              rank: 0,
              address: staker.address,
              totalVolumeStaked: staker.totalVolumeStaked,
              currentActiveStake,
              stakedCount: staker.stakedCount,
            };
          }),
        );

        const ranked = entries
          .sort((left, right) => {
            const volumeRank = compareBigIntDesc(
              left.totalVolumeStaked,
              right.totalVolumeStaked,
            );

            if (volumeRank !== 0) {
              return volumeRank;
            }

            return left.address.localeCompare(right.address);
          })
          .map((entry, index) => ({
            ...entry,
            rank: index + 1,
          }));

        setLeaderboard(ranked);
        setLastUpdated(new Date());
        setError(null);
      } catch (error) {
        console.error("Failed to load staking leaderboard", error);
        setError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    void loadLeaderboard();
  }, []);

  useEffect(() => {
    refetch();

    const interval = window.setInterval(() => {
      refetch();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refetch]);

  return {
    leaderboard,
    isLoading,
    lastUpdated,
    error,
    refetch,
  };
}
