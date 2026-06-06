export const POINTS_CONFIG = {
  SECONDS_PER_DAY: 86400,
  BASE_RATE_PER_ETH_PER_DAY: 1,
  SBT_FIRST_STAKE_BONUS: 1000,

  calculateStakePoints(amountEth: number, durationSeconds: number): number {
    const days = durationSeconds / this.SECONDS_PER_DAY;
    return amountEth * days * this.BASE_RATE_PER_ETH_PER_DAY;
  },
};

export type EventType = "stake" | "unstake" | "claim";

export interface PointsEvent {
  address: string;
  eventType: EventType;
  txHash: string;
  contractVer: "v1" | "v2";
}
