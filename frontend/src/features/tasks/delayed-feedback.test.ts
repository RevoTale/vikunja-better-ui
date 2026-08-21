import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleDelayedFeedback } from "./delayed-feedback";

describe("scheduleDelayedFeedback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits for the configured threshold", () => {
    const show = vi.fn();

    scheduleDelayedFeedback(show, 1_000);
    vi.advanceTimersByTime(999);
    expect(show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledOnce();
  });

  it("does not show feedback after cancellation", () => {
    const show = vi.fn();
    const cancel = scheduleDelayedFeedback(show, 1_000);

    cancel();
    vi.advanceTimersByTime(1_000);

    expect(show).not.toHaveBeenCalled();
  });
});
