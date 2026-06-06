import { useCallback, useEffect } from "react";
import type { EventType, PointsEvent } from "@/lib/points";

interface RecordPointsParams {
  address: string;
  eventType: EventType;
  txHash: string;
  contractVer?: "v1" | "v2";
}

type RecordPointsResponse = {
  ok?: boolean;
  retryable?: boolean;
  error?: string;
};

const PENDING_POINTS_KEY = "ritual:pending-points:v1";
const TX_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

const isCachedPointsEvent = (value: unknown): value is PointsEvent => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<PointsEvent>;

  return (
    typeof event.address === "string" &&
    event.address.startsWith("0x") &&
    typeof event.txHash === "string" &&
    TX_HASH_PATTERN.test(event.txHash) &&
    (event.eventType === "stake" ||
      event.eventType === "unstake" ||
      event.eventType === "claim") &&
    (event.contractVer === "v1" || event.contractVer === "v2")
  );
};

const readPendingEvents = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_POINTS_KEY) ?? "[]",
    );
    return Array.isArray(parsed) ? parsed.filter(isCachedPointsEvent) : [];
  } catch {
    return [];
  }
};

const writePendingEvents = (events: PointsEvent[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_POINTS_KEY, JSON.stringify(events));
};

const normalizeEvent = (params: RecordPointsParams): PointsEvent => ({
  address: params.address.toLowerCase(),
  eventType: params.eventType,
  txHash: params.txHash.toLowerCase(),
  contractVer: params.contractVer ?? "v2",
});

const enqueuePendingEvent = (event: PointsEvent) => {
  const pending = readPendingEvents();
  const filtered = pending.filter(
    (item) => item.txHash.toLowerCase() !== event.txHash.toLowerCase(),
  );
  writePendingEvents([...filtered, event].slice(-20));
};

const removePendingEvent = (txHash: string) => {
  const normalizedHash = txHash.toLowerCase();
  writePendingEvents(
    readPendingEvents().filter(
      (item) => item.txHash.toLowerCase() !== normalizedHash,
    ),
  );
};

const postPointsEvent = async (endpoint: string, event: PointsEvent) => {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  const data = (await res.json().catch(() => ({}))) as RecordPointsResponse;

  return { res, data };
};

export function useRecordPoints() {
  const flushPending = useCallback(async () => {
    const pending = readPendingEvents().slice(0, 10);

    for (const event of pending) {
      try {
        const { res, data } = await postPointsEvent("/api/points/sync", event);

        if ((res.ok && data.ok) || data.retryable === false) {
          removePendingEvent(event.txHash);
        }
      } catch (err) {
        console.warn("[useRecordPoints] sync error:", err);
        break;
      }
    }
  }, []);

  useEffect(() => {
    void flushPending();

    const handleOnline = () => {
      void flushPending();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushPending]);

  const record = useCallback(async (params: RecordPointsParams) => {
    const event = normalizeEvent(params);
    enqueuePendingEvent(event);

    try {
      const { res, data } = await postPointsEvent("/api/points/record", event);
      if ((res.ok && data.ok) || data.retryable === false) {
        removePendingEvent(event.txHash);
      }
      if (!res.ok) console.warn("[useRecordPoints] failed:", data);
      return data;
    } catch (err) {
      console.warn("[useRecordPoints] error:", err);
      return undefined;
    }
  }, []);

  return { record, flushPending };
}
