import { AppShell } from "./app-shell";

// Everything in this route group requires a signed-in user.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
