import { defineConfig, devices } from "@playwright/test";

// End-to-end against the dev server with the MSW mocks (API_URL unset).
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
    env: { API_URL: "" },
  },
});
