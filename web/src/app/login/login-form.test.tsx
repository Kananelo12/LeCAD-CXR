import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/node";
import { renderWithQuery } from "@/test/render";
import { LoginForm } from "./login-form";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(),
}));

const asleep = () =>
  HttpResponse.json(
    { detail: "The database is not reachable yet. Try again in a moment." },
    { status: 503 },
  );

// Answers 503 the first `times` calls, then lets the normal mock handle it.
function sleepyFor(method: "get" | "post", path: string, times: number) {
  let calls = 0;
  server.use(
    http[method](path, () => {
      calls += 1;
      return calls <= times ? asleep() : undefined;
    }),
  );
  return () => calls;
}

async function signIn(password = "demo") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Username"), "clinician");
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm with a database that may be asleep", () => {
  const vibrate = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    vibrate.mockReset();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("says the database is waking, then that it is ready, with a light tap", async () => {
    sleepyFor("get", "/api/health", 1);
    renderWithQuery(<LoginForm />);

    expect(await screen.findByText(/waking the database/i)).toBeInTheDocument();
    expect(await screen.findByText(/connected\. ready to sign in/i, {}, { timeout: 4000 }))
      .toBeInTheDocument();
    expect(vibrate).toHaveBeenCalledWith(18);
  });

  it("says nothing when the server answers at once", async () => {
    renderWithQuery(<LoginForm />);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("keeps trying through 503s and signs in without an error", async () => {
    const calls = sleepyFor("post", "/api/auth/login", 2);
    renderWithQuery(<LoginForm />);
    await signIn();

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    expect(
      await screen.findByRole("button", { name: /connecting to the database/i }, { timeout: 3000 }),
    ).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/analyse"), { timeout: 6000 });
    expect(calls()).toBe(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  }, 10_000);

  it("does not repeat a wrong password, and signals the error", async () => {
    let calls = 0;
    server.events.on("request:start", ({ request }) => {
      if (request.url.endsWith("/api/auth/login")) calls += 1;
    });
    renderWithQuery(<LoginForm />);
    await signIn("wrong");

    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect username or password/i);
    expect(calls).toBe(1);
    expect(vibrate).toHaveBeenCalledWith([40, 70, 40]);
    server.events.removeAllListeners();
  });
});
