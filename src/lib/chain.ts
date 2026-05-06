import { defineChain } from "viem";
import { config } from "@/lib/config";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID);
if (!Number.isInteger(chainId) || chainId <= 0) {
  throw new Error("NEXT_PUBLIC_CHAIN_ID must be a positive integer.");
}

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim();
if (!rpcUrl) {
  throw new Error("NEXT_PUBLIC_RPC_URL is required.");
}

export const ritualChain = defineChain({
  id: chainId,
  name: config.chainName,
  nativeCurrency: {
    name: config.tokenSymbol,
    symbol: config.tokenSymbol,
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: `${config.chainName} Explorer`,
      url: config.explorerUrl,
    },
  },
});
