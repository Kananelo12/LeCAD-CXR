"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "./api/client";

export const ME_KEY = ["auth", "me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: api.me, staleTime: 5 * 60_000 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.login(username, password),
    onSuccess: (data) => qc.setQueryData(ME_KEY, data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: api.logout,
    onSettled: () => {
      // Drop everything cached for this user, including history.
      qc.clear();
      router.replace("/login");
    },
  });
}

// Only same-site paths, so ?next= cannot be used to bounce users elsewhere.
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/analyse";
}
