"use client";

import { ClockCounterClockwise, Info, Scan, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/button";
import { LogoMark } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useLogout, useMe } from "@/lib/auth";

const NAV = [
  { href: "/analyse", label: "Analyse", Icon: Scan },
  { href: "/history", label: "History", Icon: ClockCounterClockwise },
  { href: "/about", label: "About the model", Icon: Info },
] as const;

// "Dr T. Mokoena" -> "TM"
function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^(dr|prof|mr|mrs|ms)\.?$/i.test(w));
  const letters = [words[0], words.length > 1 ? words[words.length - 1] : undefined]
    .filter(Boolean)
    .map((w) => w![0]);
  return letters.join("").toUpperCase();
}

const container = "mx-auto w-full max-w-[1360px] px-4 sm:px-8";

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
    return (
      <div className={`${container} py-6`} aria-busy="true">
        <div className="h-11 w-72 animate-pulse rounded-full bg-track" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (me.isError) {
    return (
      <div role="alert" className={`${container} py-16`}>
        <p className="text-lg font-medium">The server could not be reached.</p>
        <p className="mt-1 text-muted">Check your connection, then try again.</p>
        <Button variant="secondary" className="mt-6" onClick={() => me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const name = me.data.user.display_name;

  return (
    <>
      <header className={`${container} flex flex-wrap items-center gap-x-8 gap-y-4 py-5`}>
        <Link href="/analyse" className="flex items-center gap-3 rounded-xl">
          <LogoMark size={40} />
          <span className="text-[17px] font-semibold tracking-[-0.01em]">LeCAD-CXR</span>
        </Link>

        <nav aria-label="Main" className="order-last w-full sm:order-0 sm:w-auto">
          <ul className="flex gap-1 rounded-full bg-track p-1">
            {NAV.map(({ href, label, Icon }) => {
              const current = pathname.startsWith(href);
              return (
                <li key={href} className="flex-1 sm:flex-none">
                  <Link
                    href={href}
                    aria-current={current ? "page" : undefined}
                    className={`flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm whitespace-nowrap transition duration-150 sm:px-4 ${
                      current
                        ? "bg-surface font-medium text-ink shadow-panel"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon aria-hidden size={17} weight={current ? "bold" : "regular"} className="hidden sm:block" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-2.5 rounded-full bg-surface p-1 shadow-panel sm:pr-4">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-full bg-track text-xs font-semibold text-ink"
            >
              {initials(name)}
            </span>
            {/* Initials alone on phones keep the bar on one line. */}
            <span className="sr-only text-sm font-medium sm:not-sr-only">{name}</span>
          </span>
          <Button
            variant="ghost"
            className="px-3"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <SignOut aria-hidden size={17} />
            Sign out
          </Button>
        </div>
      </header>
      <main className={`${container} flex-1 pt-4 pb-16`}>{children}</main>
    </>
  );
}
