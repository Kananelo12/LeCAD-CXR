import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { resetMockState } from "@/mocks/handlers";
import { server } from "@/mocks/node";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockState();
});
afterAll(() => server.close());

// jsdom has no object URLs or canvas; the UI tolerates both being absent.
URL.createObjectURL ??= () => "blob:test";
URL.revokeObjectURL ??= () => {};
HTMLCanvasElement.prototype.getContext = (() => null) as never;
