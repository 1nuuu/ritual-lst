"use client";

import { useAccount, useReadContract } from "wagmi";
import { isSbtConfigured, puffSbtAbi, SBT_CONTRACT } from "@/lib/sbt";

export function useHasSBT() {
  const { address } = useAccount();

  const balance = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && isSbtConfigured),
    },
  });

  const hasSBT =
    Boolean(address && isSbtConfigured) &&
    (balance.data ?? BigInt(0)) > BigInt(0);

  const token = useReadContract({
    address: SBT_CONTRACT,
    abi: puffSbtAbi,
    functionName: "addressToTokenId",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && hasSBT && isSbtConfigured),
    },
  });

  return {
    hasSBT,
    tokenId: hasSBT ? token.data ?? null : null,
    isLoading:
      Boolean(address && isSbtConfigured) &&
      (balance.isLoading || token.isLoading),
  };
}
