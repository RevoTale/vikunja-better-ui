import { useQuery } from "@apollo/client/react";
import { BrandMark } from "@/components/brand-mark";
import { LoadingPlaceholder } from "@/components/loading-placeholder";
import { Button } from "@/components/ui/button";
import { PublicActivityDocument } from "@/graphql/graphql";
import { ActivityCharts, activityChartLayout } from "./activity-charts";

export function ActivityPage() {
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
      {loading && !activity ? (
        <div role="status" aria-label="Loading activity" className="space-y-6">
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
            <p>{activity.timezone} · Includes today. Cached for 10 minutes.</p>
            <p>Reload this page for a newer snapshot after the cache expires.</p>
            <p>
              Snapshot:{" "}
              <time dateTime={activity.generatedAt}>
                {new Date(activity.generatedAt).toLocaleString(undefined, {
                  timeZone: activity.timezone,
                })}
              </time>
            </p>
            <p>Only anonymous counts are public. Skipped occurrences are excluded.</p>
          </footer>
        </>
      ) : (
        <p>Public activity is not enabled.</p>
      )}
    </main>
  );
}
