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
    // Network-mocking tests need direct interception; PWA specs explicitly allow workers.
    // https://playwright.dev/docs/network#missing-network-events-and-service-workers
    serviceWorkers: "block",
    baseURL,
    timezoneId: "Pacific/Honolulu",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "test-results",
  projects: [
    {
      name: "pr-chromium",
      testMatch: [
        "app-creation.ts",
        "app-recurring-jobs.ts",
        "app-workflows.ts",
        "actionable-count.spec.ts",
        "pwa.spec.ts",
        "task-discussion-rich-text.spec.ts",
        "task-discussion.spec.ts",
        "task-editing.spec.ts",
        "task-relations.spec.ts",
      ],
      use: { viewport: { width: 1440, height: 900 }, launchOptions: chromiumLaunchOptions },
    },
    {
      name: "pr-webkit",
      testMatch: [
        "pwa-authenticated.spec.ts",
        "pwa-safe-area.spec.ts",
        "task-discussion-rich-text.spec.ts",
      ],
      use: {
        browserName: "webkit",
        viewport: { width: 320, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "phone-320",
      testMatch: [
        "pwa-safe-area.spec.ts",
        "task-discussion-rich-text.spec.ts",
        "task-discussion-toolbar.spec.ts",
        "task-list-compact-size.spec.ts",
        "task-list-size.spec.ts",
        "task-mobile-content.spec.ts",
        "task-mobile-fields.spec.ts",
      ],
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
      testMatch: [
        "pwa-authenticated.spec.ts",
        "pwa-safe-area.spec.ts",
        "task-discussion-media.spec.ts",
        "task-discussion-rich-text.spec.ts",
        "time-format.spec.ts",
      ],
      // route.fetch() does not preserve a multipart upload on WebKit, so its
      // lost-response simulation belongs to the Chromium transport suite.
      // The normal WebKit upload, paste, drop and playback cases still run.
      grepInvert: /recovers a lost upload response/,
      use: {
        browserName: "webkit",
        viewport: { width: 320, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
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
