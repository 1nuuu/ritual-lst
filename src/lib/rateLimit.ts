import type { NextRequest } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetAt: number;
};

const globalRateLimit = globalThis as typeof globalThis & {
  __ritualRateLimitBuckets?: Map<string, RateLimitBucket>;
  __ritualRateLimitHits?: number;
};

const buckets =
  globalRateLimit.__ritualRateLimitBuckets ??
  new Map<string, RateLimitBucket>();
globalRateLimit.__ritualRateLimitBuckets = buckets;
globalRateLimit.__ritualRateLimitHits ??= 0;

const cleanupExpiredBuckets = (now: number) => {
  globalRateLimit.__ritualRateLimitHits =
    (globalRateLimit.__ritualRateLimitHits ?? 0) + 1;

  if (globalRateLimit.__ritualRateLimitHits % 100 !== 0) {
    return;
  }

  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });
};

export const getClientIp = (req: NextRequest) => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const forwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    forwardedIp ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
};

export const checkRateLimit = ({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult => {
  const now = Date.now();
  cleanupExpiredBuckets(now);

  const existingBucket = buckets.get(key);
  const bucket =
    existingBucket && existingBucket.resetAt > now
      ? existingBucket
      : { count: 0, resetAt: now + windowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    limited: bucket.count > limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
};

export const getRateLimitHeaders = (result: RateLimitResult) => ({
  "X-RateLimit-Remaining": String(result.remaining),
  "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
});
