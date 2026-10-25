import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { displayTimestamp } from "@/lib/time-format";
import { useTwelveHourTime } from "@/lib/time-format-context";
import { ActivityCharts, activityChartLayout } from "./activity-charts";
import { activityOnTimeLayout } from "./activity-on-time-chart";
import { activityDataStatus } from "./activity-view-model";
import { readPublicAvailability } from "./public-activity-client";
import { PublicPageFooter } from "./public-page-footer";
import { type ActivitySource, useActivitySource } from "./use-activity-source";

export function ActivityPage() {
  const source = useActivitySource();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <BrandMark className="size-9" />
        <div>
          <h1 className="font-serif text-2xl font-semibold">Activity</h1>
          <p className="text-sm text-muted-foreground">Better Vikunja · Last 14 days</p>
        </div>
      </header>
      <ActivityNavigation authenticated={source.authenticated} />
      <ActivityBody source={source} />
    </main>
  );
}

function ActivityNavigation({ authenticated }: { authenticated: boolean }) {
  const availability = readPublicAvailability();
  return (
    <nav aria-label="Activity navigation" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <Link to={authenticated ? "/more" : "/"} className="underline underline-offset-4">
        {authenticated ? "Back to app" : "About Better Vikunja"}
      </Link>
      {authenticated || availability?.allTimeEnabled ? (
        <Link to="/all-time-activity" className="underline underline-offset-4">
          All-time activity
        </Link>
      ) : null}
    </nav>
  );
}

function ActivityBody({ source }: { source: ActivitySource }) {
  const use12Hours = useTwelveHourTime();
  const { value: activity, valueSource, loading, updating, error, reload } = source;
  if (loading && !activity) {
    return (
      <div role="status" aria-label="Loading activity" className="space-y-6">
        <LoadingPlaceholder className={activityOnTimeLayout} />
        <LoadingPlaceholder className={activityChartLayout.daily} />
        <LoadingPlaceholder className={activityChartLayout.priority} />
      </div>
    );
  }
  if (error && !activity) {
    return (
      <div role="alert" className="space-y-3">
        <p>Activity is temporarily unavailable.</p>
        <Button variant="outline" disabled={loading} onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }
  if (!activity) return <p>Public activity is not enabled.</p>;
  return (
    <>
      {updating ? (
        <p role="status" className="text-sm text-muted-foreground">
          Updating with current private data…
        </p>
      ) : null}
      {error && activity ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <p>Activity could not be refreshed. Previously loaded data remains visible.</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : null}
      <ActivityCharts activity={activity} />
      <footer className="text-sm text-muted-foreground">
        <p>
          {activity.timezone} · 14 calendar days.{" "}
          {activityDataStatus(valueSource, updating || error)}
        </p>
        {valueSource === "public" ? (
          <p>Reload after cache expiry for a newer public snapshot.</p>
        ) : null}
        <p>
          Snapshot:{" "}
          <time dateTime={activity.generatedAt}>
            {displayTimestamp(activity.generatedAt, use12Hours, activity.timezone)}
          </time>
        </p>
        <p>Only anonymous counts and percentages are public. Skipped occurrences are excluded.</p>
      </footer>
      <PublicPageFooter />
    </>
  );
}
