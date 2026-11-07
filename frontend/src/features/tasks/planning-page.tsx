import { useQuery } from "@apollo/client/react";
import { LoadFailure } from "@/components/load-failure";
import { SessionDocument } from "@/graphql/graphql";
import { isValidLocalDate } from "./local-date-time";
import { planningPreset } from "./planning-dates";
import { PlanningPeriodPicker } from "./planning-period-picker";
import type { PlanningSearch } from "./planning-search";
import { TaskListLoading } from "./task-list-loading";
import { TaskListPage } from "./task-list-page";
import { useCalendarToday } from "./use-calendar-today";

export function PlanningPage({
  search,
  setSearch,
}: {
  search: PlanningSearch;
  setSearch: (next: PlanningSearch) => void;
}) {
  const { data, error } = useQuery(SessionDocument);
  const user = data?.session.vikunjaUser;
  const today = useCalendarToday(user?.timezone);
  if (!user || !today)
    return error ? (
      <LoadFailure>Planning settings could not be loaded. Refresh the page.</LoadFailure>
    ) : (
      <TaskListLoading />
    );
  const period =
    search.period === "custom"
      ? { from: search.from ?? today, through: search.through ?? today }
      : planningPreset(search.period, today, user.weekStart);
  const valid =
    isValidLocalDate(period.from) &&
    isValidLocalDate(period.through) &&
    period.from <= period.through;
  const navigation = (
    <PlanningPeriodPicker search={search} period={period} today={today} onChange={setSearch} />
  );
  if (!valid)
    return (
      <section className="mx-auto w-full max-w-5xl">
        <h1 className="font-serif text-3xl font-semibold">Finish in period</h1>
        {navigation}
        <p role="alert" className="mt-4 text-sm text-destructive">
          Choose both dates, with Through on or after From.
        </p>
      </section>
    );
  return (
    <TaskListPage
      title="Finish in period"
      description="Planned finishes and deadlines in this period. Current periods also retain earlier unfinished work."
      scope="PERIOD"
      period={period}
      search={search}
      setSearch={(next) =>
        setSearch({ ...next, period: search.period, ...(search.period === "custom" ? period : {}) })
      }
      navigation={navigation}
    />
  );
}
