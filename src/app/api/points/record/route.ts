import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rateLimit";
import {
  parsePointsEventRequest,
  recordVerifiedPointsEvent,
} from "@/lib/server/pointsRecorder";
import { isSupabaseAdminConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const POINTS_RECORD_IP_LIMIT = 30;
const POINTS_RECORD_ADDRESS_LIMIT = 10;
const POINTS_RECORD_WINDOW_MS = 60_000;

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

  const ipLimit = checkRateLimit({
    key: `points-record:ip:${getClientIp(req)}`,
    limit: POINTS_RECORD_IP_LIMIT,
    windowMs: POINTS_RECORD_WINDOW_MS,
  });

  if (ipLimit.limited) {
    return rateLimitedResponse(ipLimit);
  }

  try {
    const body = await req.json();
    const parsed = parsePointsEventRequest(body);

    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: parsed.status },
      );
    }

    const addressLimit = checkRateLimit({
      key: `points-record:address:${parsed.event.address}`,
      limit: POINTS_RECORD_ADDRESS_LIMIT,
      windowMs: POINTS_RECORD_WINDOW_MS,
    });

    if (addressLimit.limited) {
      return rateLimitedResponse(addressLimit);
    }

    const result = await recordVerifiedPointsEvent(parsed.event);

    if (!result.ok) {
      return NextResponse.json(result, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[points/record]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
