import { defineConfig, devices } from "@playwright/test";

// End-to-end against the dev server: with the MSW mocks by default, or
// against a running FastAPI when API_URL is set (see web/README.md).
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { API_URL: process.env.API_URL ?? "" },
  },
});
