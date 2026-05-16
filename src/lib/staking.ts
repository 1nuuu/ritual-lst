const configuredStakingPoolAddress =
  process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS?.trim();

const isContractAddress = (
  value: string | undefined,
): value is `0x${string}` =>
  Boolean(value && /^0x[a-fA-F0-9]{40}$/.test(value));

export const STAKING_POOL_CONTRACT = isContractAddress(
  configuredStakingPoolAddress,
)
  ? configuredStakingPoolAddress
  : undefined;

export const isStakingPoolConfigured = Boolean(STAKING_POOL_CONTRACT);

export const stakingPoolAbi = [
  {
    type: "function",
    name: "stake",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "xRitualAmount",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "previewStake",
    stateMutability: "view",
    inputs: [
      {
        name: "ritualAmount",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "previewUnstake",
    stateMutability: "view",
    inputs: [
      {
        name: "xRitualAmount",
        type: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "claimUnstaked",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getUnbondingRequest",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "amount",
        type: "uint256",
      },
      {
        name: "claimBlock",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "blocksUntilClaimable",
    stateMutability: "view",
    inputs: [
      {
        name: "user",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "unbondingPeriod",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "totalStaked",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      {
        name: "account",
        type: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "exchangeRate",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "currentAPR",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "applyRebase",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "yieldBPS",
        type: "uint256",
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "depositYield",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;
