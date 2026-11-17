import { defineConfig, devices } from "@playwright/test";
import { env } from "node:process";

// The isolated backend must allow the configured frontend origin.
const port = Number(env.PLAYWRIGHT_PORT || 5191);
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e-backend",
  workers: 1,
  timeout: 60000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/backend", open: "never" }],
    ["json", { outputFile: "test-results/backend-results.json" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    channel: env.PLAYWRIGHT_CHANNEL || undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: { API_TARGET: "http://127.0.0.1:18080", VITE_ENABLE_MOCKS: "false" },
    url: baseURL,
    reuseExistingServer: false,
  },
});
