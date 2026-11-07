"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isTemporarilyUnavailable } from "./api/client";
import { retryDelay } from "./server-status";

export const ME_KEY = ["auth", "me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.me, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    // A sleeping database answers 503 for a moment; that is not a failed
    // sign-in (the API does not count it against the throttle), so wait and
    // send it again rather than make the user press the button twice.
    retry: (count, error) => isTemporarilyUnavailable(error) && count < 4,
    retryDelay,
    onSuccess: (data) => qc.setQueryData(ME_KEY, data),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: api.logout,
    // A full page load, not a client navigation: it discards everything held
    // in memory for this user (cached history, the image preview), which
    // matters on a shared workstation. Clearing the cache in place instead
    // would make the still-mounted shell refetch /auth/me and race this.
    onSettled: () => window.location.replace("/login"),
  });
}

// Only same-site paths, so ?next= cannot be used to bounce users elsewhere.
// Browsers read "/\host" like "//host", so backslashes are refused too.
export function safeNext(next: string | null): string {
  return next && /^\/(?![/\\])/.test(next) ? next : "/analyse";
}
