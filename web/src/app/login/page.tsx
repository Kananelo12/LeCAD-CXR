import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoMark } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-100">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <div>
            <p className="text-lg font-semibold tracking-[-0.01em]">LeCAD-CXR</p>
            <p className="text-sm text-muted">Chest X-ray decision support</p>
          </div>
        </div>
        <h1 className="mt-10 text-[2rem] leading-tight font-medium tracking-[-0.03em]">Sign in</h1>
        {/* useSearchParams (for ?next=) must sit under Suspense. */}
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-sm text-muted">
          Accounts are created by an administrator. Contact them if you need access.
        </p>
      </div>
    </main>
  );
}
