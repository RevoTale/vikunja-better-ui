import { defineConfig } from "@playwright/test";

const baseURL = process.env["E2E_BASE_URL"];
if (!baseURL) throw new Error("E2E_BASE_URL is required; run task e2e through the harness");
const chromiumExecutable = process.env["E2E_CHROMIUM_EXECUTABLE"];
const chromiumLaunchOptions = chromiumExecutable ? { executablePath: chromiumExecutable } : {};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    timezoneId: "Pacific/Honolulu",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
  projects: [
    {
      name: "phone-320",
      grep: /login restores|discussion supports/,
      use: {
        browserName: "chromium",
        launchOptions: chromiumLaunchOptions,
        viewport: { width: 320, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-webkit",
      grep: /login restores|discussion supports|discussion plays/,
      use: {
        browserName: "webkit",
        viewport: { width: 320, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "tablet-768",
      grep: /login restores|discussion supports/,
      use: { viewport: { width: 768, height: 1024 }, launchOptions: chromiumLaunchOptions },
    },
    {
      name: "desktop-1024",
      grep: /login restores|discussion supports/,
      use: { viewport: { width: 1024, height: 768 }, launchOptions: chromiumLaunchOptions },
    },
    {
      name: "desktop-1440",
      use: { viewport: { width: 1440, height: 900 }, launchOptions: chromiumLaunchOptions },
    },
    {
      name: "timezone-webkit",
      grep: /task creation and display use the Vikunja timezone/,
      use: {
        browserName: "webkit",
        timezoneId: "Asia/Tokyo",
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
