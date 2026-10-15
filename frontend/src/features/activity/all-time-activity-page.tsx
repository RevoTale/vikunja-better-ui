import { useQuery } from "@apollo/client/react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { PublicAllTimeActivityDocument } from "@/graphql/graphql";
import { activityChartLayout } from "./activity-charts";
import { activityOnTimeLayout } from "./activity-on-time-chart";
import { AllTimeActivityCharts } from "./all-time-activity-charts";

export function AllTimeActivityPage() {
  const { data, loading, error, refetch } = useQuery(PublicAllTimeActivityDocument, {
    fetchPolicy: "network-only",
  });
  const activity = data?.publicAllTimeActivity;
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <BrandMark className="size-9" />
        <div>
          <h1 className="font-serif text-2xl font-semibold">All-time activity</h1>
          <p className="text-sm text-muted-foreground">Better Vikunja · Weekly history</p>
        </div>
      </header>
      <Link to="/activity" className="text-sm underline underline-offset-4">
        Last 14 days
      </Link>
      {loading && !activity ? (
        <div role="status" aria-label="Loading all-time activity" className="space-y-6">
          <LoadingPlaceholder className="h-32 sm:h-24" />
          <div className="min-h-20 sm:min-h-10" />
          <LoadingPlaceholder className={activityOnTimeLayout} />
          <LoadingPlaceholder className={activityChartLayout.daily} />
          <LoadingPlaceholder className={activityChartLayout.priority} />
        </div>
      ) : error ? (
        <div role="alert" className="space-y-3">
          <p>All-time activity is temporarily unavailable.</p>
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
          <AllTimeActivityCharts activity={activity} />
          <footer className="text-sm text-muted-foreground">
            <p>{activity.timezone} · Monday-start weeks. Current week is partial.</p>
            <p>Cached for 1 hour. Reload after expiry for a newer snapshot.</p>
            <p>
              Snapshot: <time dateTime={activity.generatedAt}>{activity.generatedAt}</time>
            </p>
            <p>
              Anonymous completion facts only. Skips and unfinished tasks are excluded. Deleted
              tasks and missing recurrence history cannot be recovered.
            </p>
          </footer>
        </>
      ) : (
        <p>Public all-time activity is not enabled.</p>
      )}
    </main>
  );
}
