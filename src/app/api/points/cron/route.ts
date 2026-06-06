import { NextRequest, NextResponse } from "next/server";
import {
  accrueLeaderboardPoints,
  getPointsMaintenanceHealth,
  isMaintenanceAuthorized,
  reconcileLeaderboardPoints,
  runPointsRetry,
  unauthorizedMaintenanceResponse,
} from "@/lib/server/pointsMaintenance";
import { isSupabaseAdminConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_ACCRUAL_LIMIT = 500;
const DEFAULT_RETRY_LIMIT = 5;
const DEFAULT_RECONCILE_LIMIT = 100;

export async function GET(req: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: "Supabase service role is not configured" },
      { status: 503 },
    );
  }

  if (!isMaintenanceAuthorized(req)) {
    return unauthorizedMaintenanceResponse();
  }

  try {
    const { searchParams } = new URL(req.url);
    const reconciliation = await reconcileLeaderboardPoints(
      searchParams.get("reconcileLimit") ?? DEFAULT_RECONCILE_LIMIT,
    );
    const accrual = await accrueLeaderboardPoints(
      searchParams.get("accrualLimit") ?? DEFAULT_ACCRUAL_LIMIT,
    );
    const retry = await runPointsRetry(
      searchParams.get("retryLimit") ?? DEFAULT_RETRY_LIMIT,
    );
    const health = await getPointsMaintenanceHealth();

    return NextResponse.json({
      ok: true,
      reconciliation,
      accrual,
      retry,
      health,
    });
  } catch (err) {
    console.error("[points/cron]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
