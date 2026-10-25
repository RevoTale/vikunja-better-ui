import { describe, expect, it, vi } from "vitest";
import { parseActivitySnapshot, requestPublicSnapshot } from "./public-activity-client";

const activityFixture = {
  days: Array.from({ length: 14 }, (_, index) => ({
    date: `2026-10-${String(12 + index).padStart(2, "0")}`,
    count: index === 13 ? 2 : 0,
    completedWithDeadline: index === 13 ? 2 : 0,
    completedOnTime: index === 13 ? 1 : 0,
  })),
  priorities: [
    { priority: "UNSET", count: 0 },
    { priority: "HIGH", count: 2 },
  ],
  total: 2,
  timezone: "Europe/Kyiv",
  generatedAt: "2026-10-25T12:00:00Z",
  refreshAt: "2026-10-25T13:00:00Z",
};

describe("public activity client", () => {
  it("accepts the fixed anonymous activity contract", () => {
    expect(parseActivitySnapshot(activityFixture)).toEqual(activityFixture);
  });

  it("rejects malformed public data instead of rendering it", () => {
    expect(() => parseActivitySnapshot({ ...activityFixture, total: "2" })).toThrow(
      "Invalid public activity response",
    );
    expect(() =>
      parseActivitySnapshot({
        ...activityFixture,
        priorities: [{ priority: "PRIVATE", count: 2 }],
      }),
    ).toThrow("Invalid public activity response");
    expect(() =>
      parseActivitySnapshot({
        ...activityFixture,
        days: activityFixture.days.map((day, index) =>
          index === 13 ? { ...day, count: 1, completedWithDeadline: 2, completedOnTime: 3 } : day,
        ),
      }),
    ).toThrow("Invalid public activity response");
  });

  it("omits credentials from public snapshot requests", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify(activityFixture), { status: 200 }),
    );
    await expect(
      requestPublicSnapshot("/public/v1/activity", parseActivitySnapshot, fetcher),
    ).resolves.toEqual(activityFixture);
    expect(fetcher).toHaveBeenCalledWith("/public/v1/activity", {
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
  });
});
