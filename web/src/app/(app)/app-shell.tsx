"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/button";
import { ApiError } from "@/lib/api/client";
import { useLogout, useMe } from "@/lib/auth";

const NAV = [
  { href: "/analyse", label: "Analyse" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About the model" },
] as const;

// Client-side gate: FastAPI enforces auth on every request regardless, so
// this only decides what to render, never what is allowed.
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const logout = useLogout();
  const signedOut = me.error instanceof ApiError && me.error.status === 401;

  useEffect(() => {
    if (signedOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [signedOut, pathname, router]);

  if (me.isPending || signedOut) {
    return <p className="p-8 text-sm text-muted">Loading…</p>;
  }
  if (me.isError) {
    return (
      <div role="alert" className="p-8">
        <p className="font-medium">The server could not be reached.</p>
        <Button variant="secondary" className="mt-4" onClick={() => me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/analyse" className="font-semibold">
            LeCAD-CXR
          </Link>
          <nav aria-label="Main" className="flex flex-1 gap-1">
            {NAV.map(({ href, label }) => {
              const current = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    current ? "bg-surface-2 font-medium text-text" : "text-muted hover:text-text"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">{me.data.user.display_name}</span>
            <Button variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
