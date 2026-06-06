import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rateLimit";
import {
  isMaintenanceAuthorized,
  runPointsRetry,
  unauthorizedMaintenanceResponse,
} from "@/lib/server/pointsMaintenance";
import { isSupabaseAdminConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const POINTS_RETRY_IP_LIMIT = 10;
const POINTS_RETRY_WINDOW_MS = 60_000;
const DEFAULT_RETRY_LIMIT = 5;

const rateLimitedResponse = (limit: ReturnType<typeof checkRateLimit>) =>
  NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: getRateLimitHeaders(limit),
    },
  );

export async function POST(req: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      { error: "Supabase service role is not configured" },
      { status: 503 },
    );
  }

  if (!isMaintenanceAuthorized(req)) {
    return unauthorizedMaintenanceResponse();
  }

  const ipLimit = checkRateLimit({
    key: `points-retry:ip:${getClientIp(req)}`,
    limit: POINTS_RETRY_IP_LIMIT,
    windowMs: POINTS_RETRY_WINDOW_MS,
  });

  if (ipLimit.limited) {
    return rateLimitedResponse(ipLimit);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { limit?: unknown };
    return NextResponse.json(
      await runPointsRetry(body.limit ?? DEFAULT_RETRY_LIMIT),
    );
  } catch (err) {
    console.error("[points/retry]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
