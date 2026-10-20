import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { PublicActivityDocument } from "@/graphql/graphql";
import { displayTimestamp } from "@/lib/time-format";
import { useTwelveHourTime } from "@/lib/time-format-context";
import { ActivityCharts, activityChartLayout } from "./activity-charts";
import { activityOnTimeLayout } from "./activity-on-time-chart";

export function ActivityPage() {
  const use12Hours = useTwelveHourTime();
  const { data, loading, error, refetch } = useQuery(PublicActivityDocument, {
    fetchPolicy: "network-only",
  });
  const activity = data?.publicActivity;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <BrandMark className="size-9" />
        <div>
          <h1 className="font-serif text-2xl font-semibold">Activity</h1>
          <p className="text-sm text-muted-foreground">Better Vikunja · Last 14 days</p>
        </div>
      </header>
      <nav aria-label="Activity navigation" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link to="/more" className="underline underline-offset-4">
          Back to app
        </Link>
        <Link to="/all-time-activity" className="underline underline-offset-4">
          All-time activity
        </Link>
      </nav>
      {loading && !activity ? (
        <div role="status" aria-label="Loading activity" className="space-y-6">
          <LoadingPlaceholder className={activityOnTimeLayout} />
          <LoadingPlaceholder className={activityChartLayout.daily} />
          <LoadingPlaceholder className={activityChartLayout.priority} />
        </div>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <p>Activity is temporarily unavailable.</p>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void refetch().catch(() => undefined)}
          >
            Retry
          </Button>
        </div>
      ) : activity ? (
        <>
          <ActivityCharts activity={activity} />
          <footer className="text-sm text-muted-foreground">
            <p>{activity.timezone} · 14 calendar days. Cached for 1 hour.</p>
            <p>Reload this page for a newer snapshot after the cache expires.</p>
            <p>
              Snapshot:{" "}
              <time dateTime={activity.generatedAt}>
                {displayTimestamp(activity.generatedAt, use12Hours, activity.timezone)}
              </time>
            </p>
            <p>
              Only anonymous counts and percentages are public. Skipped occurrences are excluded.
            </p>
          </footer>
        </>
      ) : (
        <p>Public activity is not enabled.</p>
      )}
    </main>
  );
}
