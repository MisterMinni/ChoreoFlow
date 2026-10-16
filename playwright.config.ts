import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://127.0.0.1:8082",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--enable-unsafe-swiftshader"] },
      },
    },
  ],
  webServer: {
    command: "npm run serve:web",
    url: "http://127.0.0.1:8082",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
