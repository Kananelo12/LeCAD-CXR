import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold">LeCAD-CXR</h1>
        <p className="mt-1 text-sm text-muted">Chest X-ray decision support</p>
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
