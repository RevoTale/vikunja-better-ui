import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { activityChartLayout } from "./activity-charts";
import { activityOnTimeLayout } from "./activity-on-time-chart";
import { type AllTimeActivityView, activityDataStatus } from "./activity-view-model";
import { AllTimeActivityCharts } from "./all-time-activity-charts";
import { readPublicAvailability } from "./public-activity-client";
import { PublicPageFooter } from "./public-page-footer";
import { type ActivitySource, useAllTimeActivitySource } from "./use-activity-source";

export function AllTimeActivityPage() {
  const source = useAllTimeActivitySource();
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <BrandMark className="size-9" />
        <div>
          <h1 className="font-serif text-2xl font-semibold">All-time activity</h1>
          <p className="text-sm text-muted-foreground">Better Vikunja · Weekly history</p>
        </div>
      </header>
      <AllTimeNavigation authenticated={source.authenticated} />
      <AllTimeBody source={source} />
    </main>
  );
}

function AllTimeNavigation({ authenticated }: { authenticated: boolean }) {
  const availability = readPublicAvailability();
  return (
    <nav aria-label="Activity navigation" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
      <Link to={authenticated ? "/more" : "/"} className="underline underline-offset-4">
        {authenticated ? "Back to app" : "About Better Vikunja"}
      </Link>
      {authenticated || availability?.activityEnabled ? (
        <Link to="/activity" className="underline underline-offset-4">
          Last 14 days
        </Link>
      ) : null}
    </nav>
  );
}

function AllTimeBody({ source }: { source: ActivitySource<AllTimeActivityView> }) {
  const { value: activity, valueSource, loading, updating, error, reload } = source;
  if (loading && !activity) {
    return <AllTimeLoading />;
  }
  if (error && !activity) {
    return (
      <div role="alert" className="space-y-3">
        <p>All-time activity is temporarily unavailable.</p>
        <Button variant="outline" disabled={loading} onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }
  if (!activity) return <p>Public all-time activity is not enabled.</p>;
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
      <AllTimeActivityCharts activity={activity} filterable={valueSource === "private"} />
      <footer className="text-sm text-muted-foreground">
        <p>{activity.timezone} · Monday-start weeks. Current week is partial.</p>
        <p>
          {activityDataStatus(valueSource, updating || error)}
          {valueSource === "public" ? " Reload after expiry for newer data." : ""}
        </p>
        <p>
          Snapshot: <time dateTime={activity.generatedAt}>{activity.generatedAt}</time>
        </p>
        <p>
          Anonymous completion facts only. Skips and unfinished tasks are excluded. Deleted tasks
          and missing recurrence history cannot be recovered.
        </p>
      </footer>
      <PublicPageFooter />
    </>
  );
}

function AllTimeLoading() {
  return (
    <div role="status" aria-label="Loading all-time activity" className="space-y-6">
      <LoadingPlaceholder className="h-32 sm:h-24" />
      <div className="min-h-20 sm:min-h-10" />
      <LoadingPlaceholder className={activityOnTimeLayout} />
      <LoadingPlaceholder className={activityChartLayout.daily} />
      <LoadingPlaceholder className={activityChartLayout.priority} />
    </div>
  );
}
