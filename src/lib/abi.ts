// ── LST Protocol ABI ─────────────────────────────────────────────
// Consumer contract ABI for the liquid staking protocol.
export const lstAbi = [
  // ── Views ──
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "totalSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalStaked",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "exchangeRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "currentAPR",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "lastRebaseBlock",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "previewStake",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "previewUnstake",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "lstAmount", type: "uint256" }],
    outputs: [{ type: "uint256" }],
  },
  // ── Mutations ──
  {
    name: "stake",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "lstMinted", type: "uint256" }],
  },
  {
    name: "unstake",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "lstAmount", type: "uint256" }],
    outputs: [{ name: "tokenReturned", type: "uint256" }],
  },
  // ── Events ──
  {
    name: "Staked",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "tokenAmount", type: "uint256", indexed: false },
      { name: "lstMinted", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Unstaked",
    type: "event",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "lstBurned", type: "uint256", indexed: false },
      { name: "tokenReturned", type: "uint256", indexed: false },
    ],
  },
  {
    name: "Rebased",
    type: "event",
    inputs: [
      { name: "newExchangeRate", type: "uint256", indexed: false },
      { name: "yieldAdded", type: "uint256", indexed: false },
      { name: "blockNumber", type: "uint256", indexed: false },
    ],
  },
] as const;

// ── RitualWallet ABI ─────────────────────────────────────────────
export const ritualWalletAbi = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "lockDuration", type: "uint256" }],
    outputs: [],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "lockUntil",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;
