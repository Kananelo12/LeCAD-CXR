"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, isTemporarilyUnavailable } from "./api/client";

export const HEALTH_KEY = ["health"] as const;

// How long a request may take before the UI says why it is waiting. Below
// this, a message would only flash; above it, silence reads as frozen.
export const SLOW_AFTER_MS = 1200;

// Waits between attempts: 1, 2, 4, 4, 4… seconds. Shared by every request
// that may meet a database that is still waking.
export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 4000);

// Called as soon as the sign-in page opens. The hosted database sleeps
// after a few idle minutes (ADR 0004); this wakes it while the user is
// still typing, so pressing Sign in rarely meets a cold start. About 30 s
// of patience in total before it reports the server as unreachable.
export function useServerWarmup() {
  return useQuery({
    queryKey: HEALTH_KEY,
    queryFn: api.health,
    retry: (count, error) => isTemporarilyUnavailable(error) && count < 8,
    retryDelay,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

// True once `active` has stayed true for longer than `ms`.
export function useSlow(active: boolean, ms = SLOW_AFTER_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setSlow(true), ms);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [active, ms]);
  return active && slow;
}

// A short buzz where the device supports it (Android browsers). Desktops
// and iOS Safari have no vibration API; there it does nothing, and the
// on-screen message carries the same information.
export function haptic(kind: "ready" | "error") {
  try {
    navigator.vibrate?.(kind === "ready" ? 18 : [40, 70, 40]);
  } catch {
    // Some browsers throw when vibration is blocked by policy.
  }
}
