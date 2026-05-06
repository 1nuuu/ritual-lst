const requirePublicEnv = (name: string, rawValue: string | undefined) => {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
};

const protocolName = requirePublicEnv(
  "NEXT_PUBLIC_PROTOCOL_NAME",
  process.env.NEXT_PUBLIC_PROTOCOL_NAME,
);
const tokenSymbol = requirePublicEnv(
  "NEXT_PUBLIC_TOKEN_SYMBOL",
  process.env.NEXT_PUBLIC_TOKEN_SYMBOL,
);
const lstSymbol = requirePublicEnv(
  "NEXT_PUBLIC_LST_SYMBOL",
  process.env.NEXT_PUBLIC_LST_SYMBOL,
);
const chainName = requirePublicEnv(
  "NEXT_PUBLIC_CHAIN_NAME",
  process.env.NEXT_PUBLIC_CHAIN_NAME,
);
const explorerUrl = requirePublicEnv(
  "NEXT_PUBLIC_EXPLORER_URL",
  process.env.NEXT_PUBLIC_EXPLORER_URL,
);
const sbtName = requirePublicEnv(
  "NEXT_PUBLIC_SBT_NAME",
  process.env.NEXT_PUBLIC_SBT_NAME,
);
const sbtSymbol = requirePublicEnv(
  "NEXT_PUBLIC_SBT_SYMBOL",
  process.env.NEXT_PUBLIC_SBT_SYMBOL,
);

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
