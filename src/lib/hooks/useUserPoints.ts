import { useEffect, useState } from "react";

interface UserPoints {
  total_points: number;
  staked_amount: number;
  sbt_bonus_given: boolean;
  rank: number | null;
}

type UserPointsResponse = {
  userRank?: {
    total_points: number | string;
    staked_amount: number | string;
    sbt_bonus_given: boolean;
    rank: number | string | null;
  } | null;
};

export function useUserPoints(address: string | undefined) {
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setPoints(null);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    fetch(`/api/leaderboard?address=${address.toLowerCase()}&limit=1`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load user points.");
        }

        return response.json() as Promise<UserPointsResponse>;
      })
      .then((data) => {
        if (!data.userRank) {
          setPoints(null);
          return;
        }

        setPoints({
          total_points: Number(data.userRank.total_points),
          staked_amount: Number(data.userRank.staked_amount),
          sbt_bonus_given: Boolean(data.userRank.sbt_bonus_given),
          rank: data.userRank.rank ? Number(data.userRank.rank) : null,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setPoints(null);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [address]);

  return { points, isLoading };
}
