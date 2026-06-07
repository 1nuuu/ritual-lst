import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
} from "@/lib/rateLimit";
import { syncWalletPoints } from "@/lib/server/walletSync";
import { isSupabaseAdminConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const WALLET_SYNC_IP_LIMIT = 60;
const WALLET_SYNC_ADDRESS_LIMIT = 12;
const WALLET_SYNC_WINDOW_MS = 60_000;

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
    key: `wallet-sync:ip:${getClientIp(req)}`,
    limit: WALLET_SYNC_IP_LIMIT,
    windowMs: WALLET_SYNC_WINDOW_MS,
  });

  if (ipLimit.limited) {
    return rateLimitedResponse(ipLimit);
  }

  try {
    const body = (await req.json()) as { address?: unknown };
    const address =
      typeof body.address === "string" ? body.address.toLowerCase() : "";

    if (!isAddress(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const addressLimit = checkRateLimit({
      key: `wallet-sync:address:${address}`,
      limit: WALLET_SYNC_ADDRESS_LIMIT,
      windowMs: WALLET_SYNC_WINDOW_MS,
    });

    if (addressLimit.limited) {
      return rateLimitedResponse(addressLimit);
    }

    const result = await syncWalletPoints(address);
    const response = NextResponse.json({ ok: true, ...result });

    response.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, max-age=0, must-revalidate",
    );
    Object.entries(getRateLimitHeaders(ipLimit)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (err) {
    console.error("[wallet/sync]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
