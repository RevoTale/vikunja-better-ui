import type { WeekQuery } from "@/graphql/graphql";
import { IssueList, ListMessage } from "./list-state";
import type { TaskItem } from "./task-row";
import { groupCurrentWeekDays } from "./week-day-groups";
import { WeekDaySection } from "./week-day-section";

type WeekContentProps = {
  dataLoaded: boolean;
  error: unknown;
  loading: boolean;
  week: WeekQuery["week"] | undefined;
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
  today: string | undefined;
};

export function WeekContent({
  dataLoaded,
  error,
  loading,
  week,
  returnTo,
  completingTaskID,
  onComplete,
  today,
}: WeekContentProps) {
  if (loading && !dataLoaded) return <ListMessage>Loading week…</ListMessage>;
  if (error && !week) {
    return (
      <ListMessage tone="error">
        Week tasks could not be loaded. Try refreshing this page.
      </ListMessage>
    );
  }
  if (!week?.isComplete) return <IssueList issues={week?.issues ?? []} />;

  const currentWeek = today ? groupCurrentWeekDays(week.days, today) : undefined;

  return (
    <div className="border-b">
      {currentWeek ? (
        <>
          <WeekDaySection
            day={currentWeek.today}
            returnTo={returnTo}
            completingTaskID={completingTaskID}
            onComplete={onComplete}
            isToday
            headingLevel={2}
          />
          <WeekDayGroup
            id="week-upcoming"
            title="Upcoming"
            days={currentWeek.upcoming}
            returnTo={returnTo}
            completingTaskID={completingTaskID}
            onComplete={onComplete}
          />
          <WeekDayGroup
            id="week-earlier"
            title="Earlier this week"
            days={currentWeek.earlier}
            returnTo={returnTo}
            completingTaskID={completingTaskID}
            onComplete={onComplete}
          />
        </>
      ) : (
        week.days.map((day) => (
          <WeekDaySection
            key={day.date}
            day={day}
            returnTo={returnTo}
            completingTaskID={completingTaskID}
            onComplete={onComplete}
            isToday={false}
            headingLevel={2}
          />
        ))
      )}
    </div>
  );
}

function WeekDayGroup({
  id,
  title,
  days,
  returnTo,
  completingTaskID,
  onComplete,
}: {
  id: string;
  title: string;
  days: WeekQuery["week"]["days"];
  returnTo: string;
  completingTaskID: string | undefined;
  onComplete: (task: TaskItem) => void;
}) {
  if (days.length === 0) return null;

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-1 mt-6 text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {days.map((day) => (
        <WeekDaySection
          key={day.date}
          day={day}
          returnTo={returnTo}
          completingTaskID={completingTaskID}
          onComplete={onComplete}
          isToday={false}
          headingLevel={3}
        />
      ))}
    </section>
  );
}
