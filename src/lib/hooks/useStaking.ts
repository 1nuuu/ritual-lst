"use client";

import { useCallback, useEffect, useState } from "react";
import { BaseError } from "viem";
import {
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ritualChain } from "@/lib/chain";
import {
  isStakingPoolConfigured,
  STAKING_POOL_CONTRACT,
  stakingPoolAbi,
} from "@/lib/staking";
import {
  isXRitualConfigured,
  XRITUAL_CONTRACT,
  xRitualAbi,
} from "@/lib/xritual";

export type StakingTransactionStatus =
  | "idle"
  | "pending"
  | "success"
  | "error";

const EMPTY_UNBONDING_REQUEST = {
  amount: BigInt(0),
  claimBlock: BigInt(0),
};

const isWalletAddress = (
  value: string | undefined,
): value is `0x${string}` =>
  Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));

void isXRitualConfigured;
void XRITUAL_CONTRACT;
void xRitualAbi;

const getErrorMessage = (error: unknown) => {
  if (!error) {
    return null;
  }

  if (error instanceof BaseError) {
    return error.shortMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Transaction failed.";
};

export function useStaking(userAddress: string | undefined) {
  const [localError, setLocalError] = useState<string | null>(null);
  const contractUserAddress = isWalletAddress(userAddress)
    ? userAddress
    : undefined;

  const totalStakedRead = useReadContract({
    address: STAKING_POOL_CONTRACT,
    abi: stakingPoolAbi,
    functionName: "totalStaked",
    query: {
      enabled: isStakingPoolConfigured,
    },
  });

  const xRitualBalanceRead = useReadContract({
    address: STAKING_POOL_CONTRACT,
    abi: stakingPoolAbi,
    functionName: "balanceOf",
    args: contractUserAddress ? [contractUserAddress] : undefined,
    query: {
      enabled: Boolean(contractUserAddress && isStakingPoolConfigured),
    },
  });

  const exchangeRateRead = useReadContract({
    address: STAKING_POOL_CONTRACT,
    abi: stakingPoolAbi,
    functionName: "exchangeRate",
    query: {
      enabled: isStakingPoolConfigured,
    },
  });

  const currentAPRRead = useReadContract({
    address: STAKING_POOL_CONTRACT,
    abi: stakingPoolAbi,
    functionName: "currentAPR",
    query: {
      enabled: isStakingPoolConfigured,
    },
  });

  const unbondingRequestRead = useReadContract({
    address: STAKING_POOL_CONTRACT,
    abi: stakingPoolAbi,
    functionName: "getUnbondingRequest",
    args: contractUserAddress ? [contractUserAddress] : undefined,
    query: {
      enabled: Boolean(contractUserAddress && isStakingPoolConfigured),
    },
  });

  const blocksUntilClaimableRead = useReadContract({
    address: STAKING_POOL_CONTRACT,
    abi: stakingPoolAbi,
    functionName: "blocksUntilClaimable",
    args: contractUserAddress ? [contractUserAddress] : undefined,
    query: {
      enabled: Boolean(contractUserAddress && isStakingPoolConfigured),
    },
  });

  const refetchTotalStaked = totalStakedRead.refetch;
  const refetchXRitualBalance = xRitualBalanceRead.refetch;
  const refetchExchangeRate = exchangeRateRead.refetch;
  const refetchCurrentAPR = currentAPRRead.refetch;
  const refetchUnbondingRequest = unbondingRequestRead.refetch;
  const refetchBlocksUntilClaimable = blocksUntilClaimableRead.refetch;

  const {
    data: txHash,
    error: writeError,
    isPending,
    writeContract,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: isConfirmed,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (!isConfirmed || receipt?.status !== "success") {
      return;
    }

    refetchTotalStaked();
    refetchXRitualBalance();
    refetchExchangeRate();
    refetchCurrentAPR();
    refetchUnbondingRequest();
    refetchBlocksUntilClaimable();
  }, [
    isConfirmed,
    refetchBlocksUntilClaimable,
    refetchCurrentAPR,
    refetchExchangeRate,
    refetchTotalStaked,
    refetchUnbondingRequest,
    refetchXRitualBalance,
    receipt?.status,
  ]);

  const stake = useCallback(
    (amount: bigint) => {
      setLocalError(null);
      const stakingPoolContract = STAKING_POOL_CONTRACT;

      if (!stakingPoolContract) {
        setLocalError("Staking pool contract is not configured.");
        return;
      }

      if (amount <= BigInt(0)) {
        setLocalError("Stake amount must be greater than zero.");
        return;
      }

      writeContract({
        address: stakingPoolContract,
        abi: stakingPoolAbi,
        functionName: "stake",
        chainId: ritualChain.id,
        value: amount,
      });
    },
    [writeContract],
  );

  const unstake = useCallback(
    (amount: bigint) => {
      setLocalError(null);
      const stakingPoolContract = STAKING_POOL_CONTRACT;

      if (!stakingPoolContract) {
        setLocalError("Staking pool contract is not configured.");
        return;
      }

      if (amount <= BigInt(0)) {
        setLocalError("Unstake amount must be greater than zero.");
        return;
      }

      writeContract({
        address: stakingPoolContract,
        abi: stakingPoolAbi,
        functionName: "unstake",
        args: [amount],
        chainId: ritualChain.id,
      });
    },
    [writeContract],
  );

  const claimUnstaked = useCallback(() => {
    setLocalError(null);
    const stakingPoolContract = STAKING_POOL_CONTRACT;

    if (!stakingPoolContract) {
      setLocalError("Staking pool contract is not configured.");
      return;
    }

    writeContract({
      address: stakingPoolContract,
      abi: stakingPoolAbi,
      functionName: "claimUnstaked",
      chainId: ritualChain.id,
    });
  }, [writeContract]);

  const unbondingRequest = unbondingRequestRead.data
    ? {
        amount: unbondingRequestRead.data[0],
        claimBlock: unbondingRequestRead.data[1],
      }
    : EMPTY_UNBONDING_REQUEST;

  const receiptError =
    receipt?.status === "reverted" ? "Transaction reverted on-chain." : null;
  const txError = localError ?? getErrorMessage(writeError) ?? receiptError;

  const txStatus: StakingTransactionStatus = txError
    ? "error"
    : isPending || isConfirming
      ? "pending"
      : isConfirmed && receipt?.status === "success"
        ? "success"
        : "idle";

  return {
    totalStaked: totalStakedRead.data ?? BigInt(0),
    xRitualBalance: xRitualBalanceRead.data ?? BigInt(0),
    exchangeRate: exchangeRateRead.data ?? BigInt(0),
    currentAPR: currentAPRRead.data ?? BigInt(0),
    unbondingRequest,
    blocksUntilClaimable: blocksUntilClaimableRead.data ?? BigInt(0),
    stake,
    unstake,
    claimUnstaked,
    isLoading:
      totalStakedRead.isLoading ||
      xRitualBalanceRead.isLoading ||
      exchangeRateRead.isLoading ||
      currentAPRRead.isLoading ||
      unbondingRequestRead.isLoading ||
      blocksUntilClaimableRead.isLoading ||
      isPending ||
      isConfirming,
    txStatus,
    txError,
  };
}
