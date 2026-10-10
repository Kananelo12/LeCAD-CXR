import type { z } from "zod";
import {
  ErrorBody,
  HistoryPage,
  ModelInfo,
  Prediction,
  UserResponse,
} from "./schemas";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Every response is validated against the contract, so drift fails here
// instead of rendering something plausible and wrong.
async function request<T extends z.ZodType>(
  path: string,
  schema: T | null,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const res = await fetch(`/api${path}`, { credentials: "same-origin", ...init });

  if (!res.ok) {
    const body = ErrorBody.safeParse(await res.json().catch(() => null));
    throw new ApiError(res.status, body.success ? body.data.detail : res.statusText);
  }
  if (schema === null || res.status === 204) return undefined as z.infer<T>;

  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    console.error(`Contract violation on ${path}`, parsed.error.issues);
    throw new ApiError(res.status, "The server sent a response this app does not understand.");
  }
  return parsed.data;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  login: (username: string, password: string) =>
    request("/auth/login", UserResponse, json({ username, password })),

  logout: () => request("/auth/logout", null, { method: "POST" }),

  me: () => request("/auth/me", UserResponse),

  predict: (image: File) => {
    const form = new FormData();
    form.append("image", image);
    form.append("scope_confirmed", "true");
    return request("/predict", Prediction, { method: "POST", body: form });
  },

  history: (cursor?: string) =>
    request(`/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, HistoryPage),

  model: () => request("/model", ModelInfo),
};
