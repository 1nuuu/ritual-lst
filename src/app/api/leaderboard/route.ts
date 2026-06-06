import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rateLimit";
import { reconcileWalletStake } from "@/lib/server/pointsReconciler";
import {
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

const LEADERBOARD_COLUMNS =
  "address, total_points, staked_amount, sbt_bonus_given, rank, daily_rate, last_points_at";
const LEADERBOARD_IP_LIMIT = 120;
const LEADERBOARD_WINDOW_MS = 60_000;

type SummaryRow = {
  total_staked: number | string | null;
  unique_wallets: number | null;
};

type StakeHistoryRow = {
  month: string;
  total_staked: number | string | null;
};

const rateLimitedResponse = (limit: ReturnType<typeof checkRateLimit>) =>
  NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: getRateLimitHeaders(limit),
    },
  );

const normalizeStakeHistory = (
  rows: StakeHistoryRow[] | null,
  totalStaked: number,
) => {
  const history = (rows ?? []).map((row) => ({
    month: row.month,
    total_staked: Number(Number(row.total_staked ?? 0).toFixed(6)),
  }));

  if (history.length === 0 && totalStaked > 0) {
    const date = new Date();
    return [
      {
        month: `${date.getUTCFullYear()}-${String(
          date.getUTCMonth() + 1,
        ).padStart(2, "0")}`,
        total_staked: Number(totalStaked.toFixed(6)),
      },
    ];
  }

  return history;
};

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const limitResult = checkRateLimit({
    key: `leaderboard:ip:${getClientIp(req)}`,
    limit: LEADERBOARD_IP_LIMIT,
    windowMs: LEADERBOARD_WINDOW_MS,
  });

  if (limitResult.limited) {
    return rateLimitedResponse(limitResult);
  }

  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 500)
    : 100;
  const address = searchParams.get("address")?.toLowerCase();

  if (address && isSupabaseAdminConfigured) {
    try {
      await reconcileWalletStake(address);
    } catch (err) {
      console.warn("[leaderboard] wallet reconciliation skipped", {
        address,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const [
    { data: board, error },
    { data: summary, error: summaryError },
    { data: stakeHistoryRows, error: stakeHistoryError },
  ] = await Promise.all([
    supabase
      .from("leaderboard")
      .select(LEADERBOARD_COLUMNS)
      .order("rank", { ascending: true })
      .limit(limit),
    supabase
      .from("leaderboard_summary")
      .select("total_staked, unique_wallets")
      .maybeSingle(),
    supabase
      .from("leaderboard_stake_history")
      .select("month, total_staked")
      .order("month", { ascending: true }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (summaryError) {
    return NextResponse.json({ error: summaryError.message }, { status: 500 });
  }

  if (stakeHistoryError) {
    return NextResponse.json(
      { error: stakeHistoryError.message },
      { status: 500 },
    );
  }

  let userRank = null;
  if (address) {
    const { data: user, error: userError } = await supabase
      .from("leaderboard")
      .select(LEADERBOARD_COLUMNS)
      .eq("address", address)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    userRank = user;
  }

  const summaryRow = summary as SummaryRow | null;
  const totalStaked = Number(summaryRow?.total_staked ?? 0);
  const stakeHistory = normalizeStakeHistory(
    (stakeHistoryRows ?? []) as StakeHistoryRow[],
    totalStaked,
  );

  const response = NextResponse.json({
    board: board ?? [],
    userRank,
    summary: {
      totalStaked,
      uniqueWallets: summaryRow?.unique_wallets ?? 0,
    },
    stakeHistory,
  });

  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate",
  );
  Object.entries(getRateLimitHeaders(limitResult)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
