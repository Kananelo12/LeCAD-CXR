"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/api/client";
import { safeNext, useLogin } from "@/lib/auth";

const MOCKING = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

// Inputs follow the 10px inner radius; focus shows as the accent ring.
const input =
  "mt-2 block w-full rounded-[10px] bg-surface-2 px-3.5 py-2.5 text-ink ring-1 ring-line transition duration-150 placeholder:text-muted hover:ring-[#b9c6d6] focus:bg-surface focus:ring-2 focus:ring-accent focus:outline-none";

export function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ username, password }, { onSuccess: () => router.replace(next) });
  }

  // 401 and 429 carry a message meant for the user; anything else does not.
  const error = login.error
    ? login.error instanceof ApiError && [401, 429].includes(login.error.status)
      ? login.error.message
      : "Could not reach the server. Try again."
    : null;

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
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="mt-2 w-full" disabled={login.isPending}>
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
      {MOCKING && (
        <p className="text-xs text-muted">
          Mock API: sign in as <code>clinician</code> / <code>demo</code>.
        </p>
      )}
    </form>
  );
}
