import { defineChain } from "viem";
import { config } from "@/lib/config";

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 1979;
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim() || "https://rpc.ritualfoundation.org";

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
