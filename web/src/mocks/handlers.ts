// Mock implementation of docs/api-contract.md. Used by `npm run dev:mock`
// and by the tests. Paths include /api because MSW sees the browser's URL,
// before any Next rewrite.
import { delay, http, HttpResponse } from "msw";
import { ACCEPTED_TYPES, MAX_UPLOAD_BYTES, type HistoryItem, type User } from "@/lib/api/schemas";
import {
  MOCK_MODEL,
  MOCK_PASSWORD,
  MOCK_USERS,
  mockPrediction,
  sha256Hex,
  toHistoryItem,
} from "./fixtures";

// Stands in for the httpOnly session cookie and the audit table. Persisted
// in localStorage so a mock session survives a page reload.
const KEY = "lecad-mock";
type State = { userId: string | null; history: Record<string, HistoryItem[]> };
let memory: State = { userId: null, history: {} };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as State) : memory;
  } catch {
    return memory;
  }
}

function save(state: State) {
  memory = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // no storage: memory only
  }
}

export function resetMockState() {
  save({ userId: null, history: {} });
}

function currentUser(): User | undefined {
  const { userId } = load();
  return MOCK_USERS.find((u) => u.id === userId);
}

const unauthorized = () =>
  HttpResponse.json({ detail: "Not signed in." }, { status: 401 });

// Inference takes a moment on a real server; show the loading state in dev.
const latency = (ms: number) => delay(process.env.NODE_ENV === "test" ? 0 : ms);

export const handlers = [
  http.get("/api/health", () => HttpResponse.json({ status: "ok" })),

  http.post("/api/auth/login", async ({ request }) => {
    await latency(400);
    const body = (await request.json().catch(() => null)) as {
      username?: string;
      password?: string;
    } | null;
    const user = MOCK_USERS.find((u) => u.username === body?.username);
    if (!user || body?.password !== MOCK_PASSWORD) {
      return HttpResponse.json({ detail: "Incorrect username or password." }, { status: 401 });
    }
    save({ ...load(), userId: user.id });
    return HttpResponse.json({ user });
  }),

  http.post("/api/auth/logout", () => {
    save({ ...load(), userId: null });
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("/api/auth/me", () => {
    const user = currentUser();
    return user ? HttpResponse.json({ user }) : unauthorized();
  }),

  http.post("/api/predict", async ({ request }) => {
    const user = currentUser();
    if (!user) return unauthorized();

    const form = await request.formData();
    const image = form.get("image");
    if (form.get("scope_confirmed") !== "true") {
      return HttpResponse.json(
        { detail: "Confirm the image is a frontal adult chest X-ray." },
        { status: 422 },
      );
    }
    // Not `instanceof File`: under jsdom the File class differs from the one fetch decodes into.
    if (image === null || typeof image === "string") {
      return HttpResponse.json({ detail: "No image was uploaded." }, { status: 422 });
    }
    if (!(ACCEPTED_TYPES as readonly string[]).includes(image.type)) {
      return HttpResponse.json({ detail: "Only PNG and JPEG images are accepted." }, { status: 415 });
    }
    if (image.size > MAX_UPLOAD_BYTES) {
      return HttpResponse.json({ detail: "Image is larger than 10 MB." }, { status: 413 });
    }

    await latency(1500);
    const prediction = mockPrediction(await sha256Hex(await image.arrayBuffer()));
    const state = load();
    state.history[user.id] = [toHistoryItem(prediction), ...(state.history[user.id] ?? [])];
    save(state);
    return HttpResponse.json(prediction);
  }),

  http.get("/api/history", ({ request }) => {
    const user = currentUser();
    if (!user) return unauthorized();

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
    const start = Number(url.searchParams.get("cursor") ?? 0);
    const all = load().history[user.id] ?? [];
    const end = start + limit;
    return HttpResponse.json({
      items: all.slice(start, end),
      next_cursor: end < all.length ? String(end) : null,
    });
  }),

  http.get("/api/model", () => (currentUser() ? HttpResponse.json(MOCK_MODEL) : unauthorized())),
];
