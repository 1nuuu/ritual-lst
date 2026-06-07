import {
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  formatEther,
  http,
  isAddress,
  parseAbi,
} from "viem";
import { ritualChain } from "@/lib/chain";
import { CONTRACTS, type ContractVersion } from "@/lib/contracts";
import {
  POINTS_CONFIG,
  type EventType,
  type PointsEvent,
} from "@/lib/points";
import { SBT_CONTRACT } from "@/lib/sbt";
import { reconcileWalletStake } from "@/lib/server/pointsReconciler";
import { supabaseAdmin } from "@/lib/supabase";

type RecordAttemptStatus = "pending" | "recorded" | "failed";

type PointsRecordAttemptRow = {
  tx_hash: string;
  address: string;
  event_type: EventType;
  contract_ver: ContractVersion;
  status: RecordAttemptStatus;
  attempts: number;
  last_error: string | null;
  next_retry_at: string;
};

type ParsePointsEventResult =
  | { ok: true; event: PointsEvent }
  | { ok: false; error: string; status: number };

export type PointsRecordSuccess = {
  ok: true;
  duplicate: boolean;
  pointsAwarded: number;
  accruedPoints: number;
  sbtBonusPoints: number;
  sbtBonusGiven: boolean;
  dailyRate: number;
};

export type PointsRecordFailure = {
  ok: false;
  error: string;
  status: number;
  retryable: boolean;
  queued: boolean;
};

export type PointsRecordResult = PointsRecordSuccess | PointsRecordFailure;

const ZERO = BigInt(0);
const MAX_RETRY_DELAY_MS = 6 * 60 * 60 * 1000;
const BASE_RETRY_DELAY_MS = 30_000;

const client = createPublicClient({
  chain: ritualChain,
  transport: http(),
});

const STAKING_CONTRACTS: Record<ContractVersion, `0x${string}`> = {
  v1: CONTRACTS.v1.stakingPool,
  v2: CONTRACTS.v2.stakingPool,
};

const EVENT_FUNCTION_NAMES: Record<
  EventType,
  "stake" | "unstake" | "claimUnstaked"
> = {
  stake: "stake",
  unstake: "unstake",
  claim: "claimUnstaked",
};

const stakingAbi = parseAbi([
  "function stake() payable returns (uint256)",
  "function unstake(uint256 xRitualAmount) returns (uint256)",
  "function claimUnstaked()",
  "event Staked(address indexed user, uint256 ritualAmount, uint256 xRitualMinted)",
  "event UnstakeRequested(address indexed user, uint256 amount, uint256 claimBlock)",
  "event UnstakeClaimed(address indexed user, uint256 amount)",
]);

const sbtAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function addressToTokenId(address owner) view returns (uint256)",
  "function mintedAt(uint256 tokenId) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

class PointsRecordError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "PointsRecordError";
    this.status = status;
    this.retryable = retryable;
  }
}

export const isEventType = (value: unknown): value is EventType =>
  value === "stake" || value === "unstake" || value === "claim";

export const isContractVersion = (
  value: unknown,
): value is ContractVersion => value === "v1" || value === "v2";

export const isTxHash = (value: unknown): value is `0x${string}` =>
  typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);

export const parsePointsEventRequest = (
  body: Partial<PointsEvent>,
): ParsePointsEventResult => {
  if (!isTxHash(body.txHash)) {
    return { ok: false, error: "Invalid tx hash", status: 400 };
  }

  if (!body.address || !isAddress(body.address)) {
    return { ok: false, error: "Invalid address", status: 400 };
  }

  if (!isEventType(body.eventType)) {
    return { ok: false, error: "Invalid event type", status: 400 };
  }

  if (!isContractVersion(body.contractVer)) {
    return { ok: false, error: "Invalid contract version", status: 400 };
  }

  return {
    ok: true,
    event: {
      txHash: body.txHash.toLowerCase() as `0x${string}`,
      address: body.address.toLowerCase(),
      eventType: body.eventType,
      contractVer: body.contractVer,
    },
  };
};

const findContractVersion = (address: string | null | undefined) => {
  if (!address) {
    return null;
  }

  const normalizedAddress = address.toLowerCase();

  return (Object.keys(STAKING_CONTRACTS) as ContractVersion[]).find(
    (version) => STAKING_CONTRACTS[version].toLowerCase() === normalizedAddress,
  );
};

const addressesMatch = (a: string | undefined, b: string) =>
  Boolean(a && a.toLowerCase() === b.toLowerCase());

const findEventAmount = ({
  eventType,
  userAddress,
  contractAddress,
  logs,
}: {
  eventType: EventType;
  userAddress: string;
  contractAddress: `0x${string}`;
  logs: readonly {
    address: `0x${string}`;
    data: `0x${string}`;
    topics: readonly `0x${string}`[];
  }[];
}) => {
  const expectedEventName =
    eventType === "stake"
      ? "Staked"
      : eventType === "unstake"
        ? "UnstakeRequested"
        : "UnstakeClaimed";

  for (const log of logs) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) {
      continue;
    }

    if (log.topics.length === 0) {
      continue;
    }

    try {
      const topics = [...log.topics] as [
        `0x${string}`,
        ...`0x${string}`[],
      ];
      const decoded = decodeEventLog({
        abi: stakingAbi,
        data: log.data,
        topics,
      });

      if (decoded.eventName !== expectedEventName) {
        continue;
      }

      if (decoded.eventName === "Staked") {
        const args = decoded.args as {
          user?: `0x${string}`;
          ritualAmount?: bigint;
        };

        return addressesMatch(args.user, userAddress)
          ? args.ritualAmount
          : undefined;
      }

      if (decoded.eventName === "UnstakeRequested") {
        const args = decoded.args as {
          user?: `0x${string}`;
          amount?: bigint;
        };

        return addressesMatch(args.user, userAddress)
          ? args.amount
          : undefined;
      }

      const args = decoded.args as {
        user?: `0x${string}`;
        amount?: bigint;
      };

      return addressesMatch(args.user, userAddress) ? args.amount : undefined;
    } catch {
      // Ignore unrelated logs from the same transaction.
    }
  }

  return undefined;
};

const getBlockTimestamp = async (blockNumber: bigint) => {
  const block = await client.getBlock({ blockNumber });
  const timestamp = Number(block.timestamp);
  const timestampMs = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  const date = new Date(timestampMs);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid block timestamp");
  }

  return date;
};

const normalizeTimestampMs = (timestamp: bigint | number) => {
  const value = Number(timestamp);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value > 10_000_000_000 ? value : value * 1000;
};

const getVerifiedAmountWei = ({
  eventType,
  userAddress,
  contractAddress,
  transactionValue,
  logs,
}: {
  eventType: EventType;
  userAddress: string;
  contractAddress: `0x${string}`;
  transactionValue?: bigint;
  logs: Parameters<typeof findEventAmount>[0]["logs"];
}) => {
  const eventAmount = findEventAmount({
    eventType,
    userAddress,
    contractAddress,
    logs,
  });

  if (!eventAmount || eventAmount <= ZERO) {
    return null;
  }

  if (eventType === "stake" && transactionValue !== undefined) {
    return transactionValue === eventAmount ? eventAmount : null;
  }

  return eventAmount;
};

const getSbtBonusPoints = async ({
  address,
  blockTimestamp,
  eventType,
  contractVer,
}: {
  address: string;
  blockTimestamp: Date;
  eventType: EventType;
  contractVer: ContractVersion;
}) => {
  if (eventType !== "stake" || contractVer === "v1" || !SBT_CONTRACT) {
    return 0;
  }

  try {
    const sbtBalance = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    if (sbtBalance <= ZERO) {
      return 0;
    }

    const tokenId = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "addressToTokenId",
      args: [address as `0x${string}`],
    });

    if (tokenId <= ZERO) {
      return 0;
    }

    const owner = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "ownerOf",
      args: [tokenId],
    });

    if (!addressesMatch(owner, address)) {
      return 0;
    }

    const mintedAt = await client.readContract({
      address: SBT_CONTRACT,
      abi: sbtAbi,
      functionName: "mintedAt",
      args: [tokenId],
    });

    const mintedAtMs = normalizeTimestampMs(mintedAt);

    return mintedAtMs !== null && mintedAtMs <= blockTimestamp.getTime()
      ? POINTS_CONFIG.SBT_FIRST_STAKE_BONUS
      : 0;
  } catch {
    return 0;
  }
};

const retryDelayMs = (attempts: number) =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** Math.max(attempts - 1, 0), MAX_RETRY_DELAY_MS);

const getAttempt = async (txHash: string) => {
  const { data, error } = await supabaseAdmin
    .from("points_record_attempts")
    .select("attempts,status")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as { attempts?: number; status?: RecordAttemptStatus } | null;
};

const upsertRecordAttempt = async ({
  event,
  status,
  attempts,
  lastError,
  nextRetryAt,
  recordedAt,
}: {
  event: PointsEvent;
  status: RecordAttemptStatus;
  attempts: number;
  lastError: string | null;
  nextRetryAt: Date;
  recordedAt?: Date | null;
}) => {
  const { error } = await supabaseAdmin.from("points_record_attempts").upsert(
    {
      tx_hash: event.txHash,
      address: event.address,
      event_type: event.eventType,
      contract_ver: event.contractVer,
      status,
      attempts,
      last_error: lastError,
      next_retry_at: nextRetryAt.toISOString(),
      recorded_at: recordedAt ? recordedAt.toISOString() : null,
    },
    { onConflict: "tx_hash" },
  );

  if (error) {
    throw error;
  }
};

const safeEnsurePendingAttempt = async (event: PointsEvent) => {
  try {
    const existing = await getAttempt(event.txHash);

    if (existing?.status === "recorded") {
      return;
    }

    await upsertRecordAttempt({
      event,
      status: "pending",
      attempts: existing?.attempts ?? 0,
      lastError: null,
      nextRetryAt: new Date(),
      recordedAt: null,
    });
  } catch (err) {
    console.warn("[points/attempts] unable to create pending attempt", err);
  }
};

const safeMarkRecordAttemptRecorded = async (event: PointsEvent) => {
  try {
    const existing = await getAttempt(event.txHash);
    await upsertRecordAttempt({
      event,
      status: "recorded",
      attempts: existing?.attempts ?? 0,
      lastError: null,
      nextRetryAt: new Date(),
      recordedAt: new Date(),
    });
    return true;
  } catch (err) {
    console.warn("[points/attempts] unable to mark attempt recorded", err);
    return false;
  }
};

const safeMarkRecordAttemptFailed = async (
  event: PointsEvent,
  error: PointsRecordError,
) => {
  try {
    const existing = await getAttempt(event.txHash);
    const attempts = (existing?.attempts ?? 0) + 1;
    await upsertRecordAttempt({
      event,
      status: error.retryable ? "pending" : "failed",
      attempts,
      lastError: error.message,
      nextRetryAt: error.retryable
        ? new Date(Date.now() + retryDelayMs(attempts))
        : new Date(),
      recordedAt: null,
    });
    return true;
  } catch (err) {
    console.warn("[points/attempts] unable to mark attempt failed", err);
    return false;
  }
};

const normalizeRecordError = (err: unknown) => {
  if (err instanceof PointsRecordError) {
    return err;
  }

  console.error("[points/recordVerified]", err);
  return new PointsRecordError("Internal server error", 500, true);
};

const recordExistingDuplicate = async (
  event: PointsEvent,
): Promise<PointsRecordSuccess> => {
  await safeMarkRecordAttemptRecorded(event);

  return {
    ok: true,
    duplicate: true,
    pointsAwarded: 0,
    accruedPoints: 0,
    sbtBonusPoints: 0,
    sbtBonusGiven: false,
    dailyRate: 0,
  };
};

const recordVerifiedPointsEventOrThrow = async (
  event: PointsEvent,
): Promise<PointsRecordSuccess> => {
  const txHash = event.txHash as `0x${string}`;
  const contractAddress = STAKING_CONTRACTS[event.contractVer];

  const { data: existingTx, error: existingTxError } = await supabaseAdmin
    .from("staking_events")
    .select("id")
    .eq("tx_hash", event.txHash)
    .maybeSingle();

  if (existingTxError) {
    throw existingTxError;
  }

  if (existingTx) {
    return recordExistingDuplicate(event);
  }

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    throw new PointsRecordError("TX not found on-chain", 422, true);
  }

  if (receipt.status !== "success") {
    throw new PointsRecordError("TX reverted", 422, false);
  }

  if (receipt.from.toLowerCase() !== event.address) {
    throw new PointsRecordError("TX sender does not match address", 422, false);
  }

  const receiptContractVersion = findContractVersion(receipt.to);

  if (!receiptContractVersion) {
    throw new PointsRecordError("TX not from staking contract", 422, false);
  }

  if (receiptContractVersion !== event.contractVer) {
    throw new PointsRecordError("Contract version mismatch", 422, false);
  }

  let transaction;
  try {
    transaction = await client.getTransaction({ hash: txHash });
  } catch {
    transaction = null;
  }

  if (transaction) {
    let functionName;
    try {
      ({ functionName } = decodeFunctionData({
        abi: stakingAbi,
        data: transaction.input,
      }));
    } catch {
      throw new PointsRecordError("Unable to decode staking function", 422, false);
    }

    if (functionName !== EVENT_FUNCTION_NAMES[event.eventType]) {
      throw new PointsRecordError("TX function does not match event type", 422, false);
    }
  }

  let blockTimestamp: Date;
  try {
    blockTimestamp = await getBlockTimestamp(receipt.blockNumber);
  } catch {
    blockTimestamp = new Date();
  }

  const amountWei = getVerifiedAmountWei({
    eventType: event.eventType,
    userAddress: event.address,
    contractAddress,
    transactionValue: transaction?.value,
    logs: receipt.logs,
  });

  if (!amountWei) {
    throw new PointsRecordError("Unable to verify staking amount", 422, false);
  }

  const sbtBonusPoints = await getSbtBonusPoints({
    address: event.address,
    blockTimestamp,
    eventType: event.eventType,
    contractVer: event.contractVer,
  });

  const { data: recordResult, error: recordError } = await supabaseAdmin
    .rpc("record_staking_event", {
      p_address: event.address,
      p_event_type: event.eventType,
      p_amount_wei: amountWei.toString(),
      p_amount_eth: formatEther(amountWei),
      p_tx_hash: event.txHash,
      p_block_number: Number(receipt.blockNumber),
      p_contract_ver: event.contractVer,
      p_block_timestamp: blockTimestamp.toISOString(),
      p_sbt_bonus_points: sbtBonusPoints,
    })
    .single();

  if (recordError) {
    throw new PointsRecordError("Unable to record points", 500, true);
  }

  const result = recordResult as {
    duplicate?: boolean;
    points_awarded?: string | number;
    accrued_points?: string | number;
    sbt_bonus_points?: string | number;
    sbt_bonus_given?: boolean;
    daily_rate?: string | number;
  };

  let reconciledDailyRate: number | null = null;
  try {
    const reconciled = await reconcileWalletStake(event.address);
    reconciledDailyRate = reconciled.dailyRate;
  } catch (err) {
    console.warn("[points/recordVerified] reconciliation skipped", {
      address: event.address,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await safeMarkRecordAttemptRecorded(event);

  return {
    ok: true,
    duplicate: Boolean(result.duplicate),
    pointsAwarded: Number(result.points_awarded ?? 0),
    accruedPoints: Number(result.accrued_points ?? 0),
    sbtBonusPoints: Number(result.sbt_bonus_points ?? 0),
    sbtBonusGiven: Boolean(result.sbt_bonus_given),
    dailyRate: reconciledDailyRate ?? Number(result.daily_rate ?? 0),
  };
};

export const recordVerifiedPointsEvent = async (
  event: PointsEvent,
): Promise<PointsRecordResult> => {
  await safeEnsurePendingAttempt(event);

  try {
    return await recordVerifiedPointsEventOrThrow(event);
  } catch (err) {
    const recordError = normalizeRecordError(err);
    const queued = recordError.retryable
      ? await safeMarkRecordAttemptFailed(event, recordError)
      : false;

    if (!recordError.retryable) {
      await safeMarkRecordAttemptFailed(event, recordError);
    }

    return {
      ok: false,
      error: recordError.message,
      status: recordError.status,
      retryable: recordError.retryable,
      queued,
    };
  }
};

export const getDuePointsRecordAttempts = async (limit: number) => {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 10);

  const { data, error } = await supabaseAdmin
    .from("points_record_attempts")
    .select(
      "tx_hash,address,event_type,contract_ver,status,attempts,last_error,next_retry_at",
    )
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as PointsRecordAttemptRow[]).map((row) => ({
    txHash: row.tx_hash as `0x${string}`,
    address: row.address,
    eventType: row.event_type,
    contractVer: row.contract_ver,
    attempts: row.attempts,
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at,
  }));
};
