import {
  createPublicClient,
  http,
  isAddress,
  parseAbi,
} from "viem";
import { ritualChain } from "@/lib/chain";
import { POINTS_CONFIG } from "@/lib/points";
import { SBT_CONTRACT } from "@/lib/sbt";
import { getActiveStakeEth } from "@/lib/server/pointsReconciler";
import { supabaseAdmin } from "@/lib/supabase";

type SbtStatus = {
  hasSbt: boolean;
  tokenId: string | null;
};

export type WalletPointsSyncResult = {
  address: string;
  hasSbt: boolean;
  sbtTokenId: string | null;
  activeStake: number;
  accruedPoints: number;
  sbtBonusPoints: number;
  totalPoints: number;
  stakedAmount: number;
  dailyRate: number;
  sbtBonusGiven: boolean;
  stakeChanged: boolean;
};

const ZERO = BigInt(0);

const client = createPublicClient({
  chain: ritualChain,
  transport: http(),
});

const sbtAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function addressToTokenId(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

const addressesMatch = (a: string | undefined, b: string) =>
  Boolean(a && a.toLowerCase() === b.toLowerCase());

const getWalletSbtStatus = async (
  address: `0x${string}`,
): Promise<SbtStatus> => {
  if (!SBT_CONTRACT) {
    return { hasSbt: false, tokenId: null };
  }

  try {
    const balance = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "balanceOf",
      args: [address],
    });

    if (balance <= ZERO) {
      return { hasSbt: false, tokenId: null };
    }

    const tokenId = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "addressToTokenId",
      args: [address],
    });

    if (tokenId <= ZERO) {
      return { hasSbt: false, tokenId: null };
    }

    const owner = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "ownerOf",
      args: [tokenId],
    });

    if (!addressesMatch(owner, address)) {
      return { hasSbt: false, tokenId: null };
    }

    return { hasSbt: true, tokenId: tokenId.toString() };
  } catch (err) {
    console.warn("[wallet/sync] unable to verify SBT holder", {
      address,
      error: err instanceof Error ? err.message : String(err),
    });
    return { hasSbt: false, tokenId: null };
  }
};

export const syncWalletPoints = async (
  address: string,
): Promise<WalletPointsSyncResult> => {
  if (!isAddress(address)) {
    throw new Error("Invalid address");
  }

  const normalizedAddress = address.toLowerCase() as `0x${string}`;
  const [sbtStatus, activeStake] = await Promise.all([
    getWalletSbtStatus(normalizedAddress),
    getActiveStakeEth(normalizedAddress),
  ]);

  const { data, error } = await supabaseAdmin
    .rpc("sync_wallet_points", {
      p_address: normalizedAddress,
      p_staked_amount: activeStake,
      p_sbt_bonus_points: sbtStatus.hasSbt
        ? POINTS_CONFIG.SBT_FIRST_STAKE_BONUS
        : 0,
    })
    .single();

  if (error) {
    throw error;
  }

  const result = data as {
    address?: string | null;
    accrued_points?: string | number | null;
    sbt_bonus_points?: string | number | null;
    total_points?: string | number | null;
    staked_amount?: string | number | null;
    daily_rate?: string | number | null;
    sbt_bonus_given?: boolean | null;
    stake_changed?: boolean | null;
  } | null;

  return {
    address: result?.address ?? normalizedAddress,
    hasSbt: sbtStatus.hasSbt,
    sbtTokenId: sbtStatus.tokenId,
    activeStake: Number(activeStake),
    accruedPoints: Number(result?.accrued_points ?? 0),
    sbtBonusPoints: Number(result?.sbt_bonus_points ?? 0),
    totalPoints: Number(result?.total_points ?? 0),
    stakedAmount: Number(result?.staked_amount ?? activeStake),
    dailyRate: Number(result?.daily_rate ?? activeStake),
    sbtBonusGiven: Boolean(result?.sbt_bonus_given),
    stakeChanged: Boolean(result?.stake_changed),
  };
};
