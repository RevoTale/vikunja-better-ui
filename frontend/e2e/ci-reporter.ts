import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  FullResult,
  Reporter,
  TestCase,
  TestError,
  TestResult,
} from "@playwright/test/reporter";

export function safeDiagnostic(message: string) {
  // Playwright errors can quote a fill() argument, Authorization header or long cookie/CSRF value.
  return message.replace(/tk_[\w.-]+|Bearer\s+[\w.=-]+|[\w-]{32,}={0,2}/gi, "[redacted]");
}

export default class CIReporter implements Reporter {
  printsToStdio() {
    return true;
  }

  onTestEnd(testCase: TestCase, result: TestResult) {
    console.log(
      `${result.status} ${testCase.titlePath().filter(Boolean).join(" › ")} (${result.duration} ms)`,
    );
    if (result.status === testCase.expectedStatus) return;
    for (const error of result.errors) this.onError(error);
    const directory = join("test-results", `${testCase.id}-retry-${result.retry}`);
    for (const [index, attachment] of result.attachments.entries()) {
      if (!attachment.path) continue;
      const extension = { "image/png": "png", "video/webm": "webm" }[attachment.contentType];
      if (!extension) continue;
      mkdirSync(directory, { recursive: true });
      const file = join(directory, `failure-${index}.${extension}`);
      copyFileSync(attachment.path, file);
      console.log(file);
    }
  }

  onError(error: TestError) {
    console.error(
      safeDiagnostic(error.stack ?? error.message ?? error.value ?? "Unspecified test failure"),
    );
  }

  onEnd(result: FullResult) {
    console.log(`Browser suite ${result.status} (${result.duration} ms)`);
  }
}
