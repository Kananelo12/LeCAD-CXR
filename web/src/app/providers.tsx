"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError, holdRequestsUntil, isTemporarilyUnavailable } from "@/lib/api/client";
import { ME_KEY } from "@/lib/auth";
import { retryDelay } from "@/lib/server-status";

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

// Once per page load, at module level: an effect would run twice under
// StrictMode, and MSW refuses to start twice.
if (MOCKING && typeof window !== "undefined") {
  holdRequestsUntil(
    import("@/mocks/browser").then(({ worker }) =>
      worker.start({ onUnhandledRequest: "bypass", quiet: true }),
    ),
  );
}

function makeQueryClient() {
  // Any other 401 means the session ended: refetch /auth/me (if a signed-in
  // page is showing), whose failure sends the user to /login (see AppShell).
  // Never for /auth/me itself, which would loop.
  const onError = (error: Error, key?: readonly unknown[]) => {
    const isMe = key?.[0] === ME_KEY[0] && key?.[1] === ME_KEY[1];
    if (error instanceof ApiError && error.status === 401 && !isMe) {
      void client.resetQueries({ queryKey: ME_KEY });
    }
  };
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => onError(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error) => onError(error) }),
    defaultOptions: {
      queries: {
        // A database waking from sleep gets more patience (about 15 s) than
        // a genuine server error; an answer such as 401 or 404 gets none.
        retry: (count, error) =>
          isTemporarilyUnavailable(error)
            ? count < 5
            : !(error instanceof ApiError && error.status < 500) && count < 2,
        retryDelay,
        refetchOnWindowFocus: false,
      },
    },
  });
  return client;
}

let browserClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      {MOCKING && (
        <p className="fixed right-3 bottom-3 rounded bg-surface-2 px-2 py-1 font-mono text-xs text-muted">
          mock API
        </p>
      )}
    </QueryClientProvider>
  );
}
