export const CONTRACTS = {
  v1: {
    stakingPool: "0x161f394F46c0Eb7Cc6AE4691815130684b607eaE" as `0x${string}`,
    xRitual: "0x7Bb1cA1Df4Aa62A441e37Adc5DF814E8C61d2001" as `0x${string}`,
    deploymentBlock: BigInt(20756390),
  },
  v2: {
    stakingPool: "0x4A425149530451c8729038b0eed63dB5EE3bB3ce" as `0x${string}`,
    xRitual: "0x657F74071239744BCa740A45AA3dE7dbC985D2f7" as `0x${string}`,
    deploymentBlock: BigInt(27755348),
  },
} as const;

export type ContractVersion = keyof typeof CONTRACTS;
