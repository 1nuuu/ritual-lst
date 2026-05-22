import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { ritualChain } from "./chain";
import { config } from "./config";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

const connectors = [
  injected(),
  ...(walletConnectProjectId
    ? [walletConnect({ projectId: walletConnectProjectId })]
    : []),
  coinbaseWallet({ appName: config.protocolName }),
];

export const wagmiConfig = createConfig({
  chains: [ritualChain],
  connectors,
  transports: {
    [ritualChain.id]: http(),
  },
});
