const env = (name: string, fallback: string): string =>
  process.env[name]?.trim() || fallback;

const protocolName = env("NEXT_PUBLIC_PROTOCOL_NAME", "Ritual Staking");
const tokenSymbol = env("NEXT_PUBLIC_TOKEN_SYMBOL", "RITUAL");
const lstSymbol = env("NEXT_PUBLIC_LST_SYMBOL", "xRITUAL");
const chainName = env("NEXT_PUBLIC_CHAIN_NAME", "Ritual Chain");
const explorerUrl = env("NEXT_PUBLIC_EXPLORER_URL", "https://explorer.ritualfoundation.org");
const sbtName = env("NEXT_PUBLIC_SBT_NAME", "Ritual Identity SBT");
const sbtSymbol = env("NEXT_PUBLIC_SBT_SYMBOL", "rSBT");

export const config = {
  protocolName,
  tokenSymbol,
  lstSymbol,
  chainName,
  explorerUrl,
  sbtName,
  sbtSymbol,
} as const;

export const prefixedSymbol = (symbol: string) =>
  symbol.startsWith("$") ? symbol : `$${symbol}`;

export const terminalSlug = protocolName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
