import {
  createPublicClient,
  formatEther,
  http,
  isAddress,
  parseAbi,
} from "viem";
import { ritualChain } from "@/lib/chain";
import { CONTRACTS } from "@/lib/contracts";
import { supabaseAdmin } from "@/lib/supabase";

type UserPointsStakeRow = {
  address: string;
  staked_amount: string | number | null;
  daily_rate: string | number | null;
};

export type WalletReconciliationResult = {
  address: string;
  activeStake: number;
  stakeChanged: boolean;
  totalPoints: number;
  dailyRate: number;
};

export type ReconciliationSummary = {
  ok: true;
  checked: number;
  reconciled: number;
  failed: number;
  results: WalletReconciliationResult[];
};

const ZERO = BigInt(0);
const WEI_SCALE = BigInt(10) ** BigInt(18);
const DEFAULT_RECONCILE_LIMIT = 100;

const client = createPublicClient({
  chain: ritualChain,
  transport: http(),
});

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

const stakingPoolAbi = parseAbi([
  "function exchangeRate() view returns (uint256)",
]);

const safeLimit = (value: unknown, fallback: number, max: number) => {
  const limit = Number(value ?? fallback);

  return Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), max)
    : fallback;
};

const getV2ActiveStakeWei = async (address: `0x${string}`) => {
  const contracts = CONTRACTS.v2;
  const xRitualBalance = await client.readContract({
    address: contracts.xRitual,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });

  if (xRitualBalance === ZERO) {
    return ZERO;
  }

  const exchangeRate = await client.readContract({
    address: contracts.stakingPool,
    abi: stakingPoolAbi,
    functionName: "exchangeRate",
  });

  return (xRitualBalance * exchangeRate) / WEI_SCALE;
};

export const getActiveStakeEth = async (address: string) => {
  if (!isAddress(address)) {
    throw new Error("Invalid address");
  }

  const normalizedAddress = address.toLowerCase() as `0x${string}`;
  const v2StakeWei = await getV2ActiveStakeWei(normalizedAddress);

  return formatEther(v2StakeWei);
};

export const reconcileWalletStake = async (
  address: string,
): Promise<WalletReconciliationResult> => {
  if (!isAddress(address)) {
    throw new Error("Invalid address");
  }

  const normalizedAddress = address.toLowerCase();
  const activeStake = await getActiveStakeEth(normalizedAddress);
  const { data, error } = await supabaseAdmin
    .rpc("reconcile_user_points", {
      p_address: normalizedAddress,
      p_staked_amount: activeStake,
    })
    .single();

  if (error) {
    throw error;
  }

  const result = data as {
    address?: string | null;
    total_points?: string | number | null;
    staked_amount?: string | number | null;
    daily_rate?: string | number | null;
    stake_changed?: boolean | null;
  } | null;

  return {
    address: result?.address ?? normalizedAddress,
    activeStake: Number(result?.staked_amount ?? activeStake),
    stakeChanged: Boolean(result?.stake_changed),
    totalPoints: Number(result?.total_points ?? 0),
    dailyRate: Number(result?.daily_rate ?? 0),
  };
};

export const runPointsReconciliation = async (
  requestedLimit: unknown = DEFAULT_RECONCILE_LIMIT,
): Promise<ReconciliationSummary> => {
  const limit = safeLimit(requestedLimit, DEFAULT_RECONCILE_LIMIT, 500);
  const { data, error } = await supabaseAdmin
    .from("user_points")
    .select("address,staked_amount,daily_rate")
    .or("staked_amount.gt.0,daily_rate.gt.0")
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as UserPointsStakeRow[];
  const results: WalletReconciliationResult[] = [];
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await reconcileWalletStake(row.address);
      results.push(result);
    } catch (err) {
      failed += 1;
      console.warn("[points/reconcile] unable to reconcile wallet", {
        address: row.address,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    ok: true,
    checked: rows.length,
    reconciled: results.filter((result) => result.stakeChanged).length,
    failed,
    results,
  };
};
