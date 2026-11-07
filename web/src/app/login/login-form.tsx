"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/button";
import { ApiError, isTemporarilyUnavailable } from "@/lib/api/client";
import { safeNext, useLogin } from "@/lib/auth";
import { haptic, useServerWarmup, useSlow } from "@/lib/server-status";

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

// Inputs follow the 10px inner radius; focus shows as the accent ring.
const input =
  "mt-2 block w-full rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-ink ring-1 ring-line transition duration-150 placeholder:text-muted hover:ring-[#b9c6d6] focus:bg-surface focus:ring-2 focus:ring-accent focus:outline-none";

const dotTone = { waiting: "bg-caution animate-pulse", ok: "bg-clear", down: "bg-danger" } as const;

function StatusLine({ tone, children }: { tone: keyof typeof dotTone; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-sm text-muted">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${dotTone[tone]}`} />
      <span>{children}</span>
    </p>
  );
}

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Wake the database now, while the user types (ADR 0004).
  const health = useServerWarmup();
  const healthSlow = useSlow(health.isPending);
  const waking = health.isPending && (healthSlow || health.failureCount > 0);
  // Remembered across renders (React's guarded set-during-render pattern),
  // so the confirmation below appears only after a wait the user saw.
  const [hadToWait, setHadToWait] = useState(false);
  if (waking && !hadToWait) setHadToWait(true);

  // After a visible wait, confirm the server is ready: a brief "Connected"
  // and, on phones that support it, a light tap.
  const [connectedSeen, setConnectedSeen] = useState(false);
  const showConnected = hadToWait && health.isSuccess && !connectedSeen;
  useEffect(() => {
    if (!showConnected) return;
    haptic("ready");
    const t = setTimeout(() => setConnectedSeen(true), 4000);
    return () => clearTimeout(t);
  }, [showConnected]);

  const signingInSlowly = useSlow(login.isPending);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => router.replace(next), onError: () => haptic("error") },
    );
  }

  // 401 and 429 carry a message meant for the user; anything else does not.
  const error = login.error
    ? login.error instanceof ApiError && [401, 429].includes(login.error.status)
      ? login.error.message
      : isTemporarilyUnavailable(login.error)
        ? "The server is taking longer than usual to answer. Wait a few seconds, then sign in again."
        : "Something went wrong on the server. Try again, and if it keeps happening, contact the administrator."
    : null;

  // One status at a time. The sign-in error, when there is one, says more.
  let status: ReactNode = null;
  if (!error && !login.isPending) {
    if (waking) {
      status = (
        <StatusLine tone="waiting">
          Waking the database. This takes a few seconds after a quiet spell. You can sign in
          now; it will wait.
        </StatusLine>
      );
    } else if (health.isError) {
      status = (
        <StatusLine tone="down">
          The server is not responding yet.{" "}
          <button
            type="button"
            onClick={() => health.refetch()}
            className="font-medium text-accent-text underline underline-offset-2"
          >
            Check again
          </button>
        </StatusLine>
      );
    } else if (showConnected) {
      status = <StatusLine tone="ok">Connected. Ready to sign in.</StatusLine>;
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-2xl bg-surface p-6 shadow-panel sm:p-7">
      <div>
        <label htmlFor="username" className="text-sm font-medium">
          Username
        </label>
        <input
          id="username"
          className={input}
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          className={input}
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {/* Always mounted, so screen readers announce each change. */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {status}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="mt-2 w-full"
        disabled={login.isPending}
        aria-busy={login.isPending}
      >
        {login.isPending
          ? signingInSlowly
            ? "Connecting to the database…"
            : "Signing in…"
          : "Sign in"}
      </Button>
      {MOCKING && (
        <p className="text-xs text-muted">
          Mock API: sign in as <code>clinician</code> / <code>demo</code>.
        </p>
      )}
    </form>
  );
}
