import { NextRequest, NextResponse } from "next/server";
import {
  getDuePointsRecordAttempts,
  recordVerifiedPointsEvent,
} from "@/lib/server/pointsRecorder";
import {
  runPointsReconciliation,
  type ReconciliationSummary,
} from "@/lib/server/pointsReconciler";
import { supabaseAdmin } from "@/lib/supabase";

type RetrySummary = {
  ok: true;
  processed: number;
  recorded: number;
  pending: number;
  failed: number;
  results: {
    txHash: string;
    status: "recorded" | "pending" | "failed";
  }[];
};

type AccrualSummary = {
  ok: true;
  updatedWallets: number;
  totalAccrued: number;
  runAt: string | null;
};

type QueueOldestPendingRow = {
  created_at: string | null;
  next_retry_at: string | null;
};

type QueueRecentFailureRow = {
  tx_hash: string;
  address: string;
  event_type: string;
  contract_ver: string;
  attempts: number;
  last_error: string | null;
  updated_at: string;
};

const DEFAULT_RETRY_LIMIT = 5;
const DEFAULT_ACCRUAL_LIMIT = 500;
const DEFAULT_RECONCILE_LIMIT = 100;
const STALE_PENDING_MINUTES = 60;

const maintenanceSecrets = [
  process.env.CRON_SECRET?.trim(),
  process.env.POINTS_RETRY_SECRET?.trim(),
].filter((secret): secret is string => Boolean(secret));

export const isMaintenanceAuthorized = (req: NextRequest) => {
  if (maintenanceSecrets.length === 0) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = req.headers.get("authorization");
  const pointsRetrySecret = req.headers.get("x-points-retry-secret");
  const cronSecret = req.headers.get("x-cron-secret");

  return maintenanceSecrets.some(
    (secret) =>
      authorization === `Bearer ${secret}` ||
      pointsRetrySecret === secret ||
      cronSecret === secret,
  );
};

export const unauthorizedMaintenanceResponse = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

const safeLimit = (value: unknown, fallback: number, max: number) => {
  const limit = Number(value ?? fallback);

  return Number.isFinite(limit)
    ? Math.min(Math.max(Math.floor(limit), 1), max)
    : fallback;
};

export const runPointsRetry = async (
  requestedLimit: unknown = DEFAULT_RETRY_LIMIT,
): Promise<RetrySummary> => {
  const attempts = await getDuePointsRecordAttempts(
    safeLimit(requestedLimit, DEFAULT_RETRY_LIMIT, 10),
  );

  let recorded = 0;
  let pending = 0;
  let failed = 0;

  const results = [];

  for (const attempt of attempts) {
    const result = await recordVerifiedPointsEvent({
      address: attempt.address,
      eventType: attempt.eventType,
      txHash: attempt.txHash,
      contractVer: attempt.contractVer,
    });

    if (result.ok) {
      recorded += 1;
    } else if (result.retryable) {
      pending += 1;
    } else {
      failed += 1;
    }

    const status: "recorded" | "pending" | "failed" = result.ok
      ? "recorded"
      : result.retryable
        ? "pending"
        : "failed";

    results.push({
      txHash: attempt.txHash,
      status,
    });
  }

  return {
    ok: true,
    processed: attempts.length,
    recorded,
    pending,
    failed,
    results,
  };
};

export const accrueLeaderboardPoints = async (
  requestedLimit: unknown = DEFAULT_ACCRUAL_LIMIT,
): Promise<AccrualSummary> => {
  const { data, error } = await supabaseAdmin
    .rpc("accrue_leaderboard_points", {
      p_limit: safeLimit(requestedLimit, DEFAULT_ACCRUAL_LIMIT, 5000),
    })
    .single();

  if (error) {
    throw error;
  }

  const result = data as {
    updated_wallets?: number | string | null;
    total_accrued?: number | string | null;
    run_at?: string | null;
  } | null;

  return {
    ok: true,
    updatedWallets: Number(result?.updated_wallets ?? 0),
    totalAccrued: Number(result?.total_accrued ?? 0),
    runAt: result?.run_at ?? null,
  };
};

export const reconcileLeaderboardPoints = async (
  requestedLimit: unknown = DEFAULT_RECONCILE_LIMIT,
): Promise<ReconciliationSummary> =>
  runPointsReconciliation(
    safeLimit(requestedLimit, DEFAULT_RECONCILE_LIMIT, 500),
  );

export const getPointsMaintenanceHealth = async () => {
  const staleCutoff = new Date(
    Date.now() - STALE_PENDING_MINUTES * 60 * 1000,
  ).toISOString();

  const [
    { count: pendingCount, error: pendingError },
    { count: recordedCount, error: recordedError },
    { count: failedCount, error: failedError },
    { data: oldestPending, error: oldestPendingError },
    { count: stalePendingCount, error: stalePendingError },
    { data: recentFailures, error: recentFailuresError },
  ] = await Promise.all([
    supabaseAdmin
      .from("points_record_attempts")
      .select("tx_hash", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("points_record_attempts")
      .select("tx_hash", { count: "exact", head: true })
      .eq("status", "recorded"),
    supabaseAdmin
      .from("points_record_attempts")
      .select("tx_hash", { count: "exact", head: true })
      .eq("status", "failed"),
    supabaseAdmin
      .from("points_record_attempts")
      .select("created_at,next_retry_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("points_record_attempts")
      .select("tx_hash", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("updated_at", staleCutoff),
    supabaseAdmin
      .from("points_record_attempts")
      .select(
        "tx_hash,address,event_type,contract_ver,attempts,last_error,updated_at",
      )
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  if (pendingError) {
    throw pendingError;
  }
  if (recordedError) {
    throw recordedError;
  }
  if (failedError) {
    throw failedError;
  }
  if (oldestPendingError) {
    throw oldestPendingError;
  }
  if (stalePendingError) {
    throw stalePendingError;
  }
  if (recentFailuresError) {
    throw recentFailuresError;
  }

  const oldest = oldestPending as QueueOldestPendingRow | null;
  const failures = (recentFailures ?? []) as QueueRecentFailureRow[];

  return {
    ok: (failedCount ?? 0) === 0 && (stalePendingCount ?? 0) === 0,
    counts: {
      pending: pendingCount ?? 0,
      recorded: recordedCount ?? 0,
      failed: failedCount ?? 0,
      stalePending: stalePendingCount ?? 0,
    },
    oldestPendingAt: oldest?.created_at ?? null,
    oldestNextRetryAt: oldest?.next_retry_at ?? null,
    recentFailures: failures.map((failure) => ({
      txHash: failure.tx_hash,
      address: failure.address,
      eventType: failure.event_type,
      contractVer: failure.contract_ver,
      attempts: failure.attempts,
      lastError: failure.last_error,
      updatedAt: failure.updated_at,
    })),
  };
};
