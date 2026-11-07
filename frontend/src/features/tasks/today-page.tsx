import { useQuery } from "@apollo/client/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LoadFailure } from "@/components/load-failure";
import { Button } from "@/components/ui/button";
import { SessionDocument } from "@/graphql/graphql";
import { type DaySearch, navigateDaySearch } from "./day-search";
import { FutureDayPage } from "./future-day-page";
import { TaskListLoading } from "./task-list-loading";
import { TaskListPage } from "./task-list-page";
import { useCalendarToday } from "./use-calendar-today";

export function TodayPage({
  search,
  setSearch,
}: {
  search: DaySearch;
  setSearch: (next: DaySearch) => void;
}) {
  const { data, error } = useQuery(SessionDocument);
  const timezone = data?.session.vikunjaUser?.timezone;
  const today = useCalendarToday(timezone);
  const date = search.date ?? today;
  const navigate = (offset: number | null) => {
    const next = navigateDaySearch(search, timezone, offset);
    if (next) setSearch(next);
  };
  const navigation = (
    <nav aria-label="Day navigation" className="mt-4 flex flex-wrap gap-2">
      <Button variant="outline" disabled={!date} onClick={() => navigate(-1)}>
        <ChevronLeft aria-hidden="true" /> Previous day
      </Button>
      <Button variant="outline" onClick={() => navigate(null)}>
        Today
      </Button>
      <Button variant="outline" disabled={!date} onClick={() => navigate(1)}>
        Next day <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
  if (search.date && !today) {
    return error ? (
      <LoadFailure>Timezone could not be loaded. Refresh the page.</LoadFailure>
    ) : (
      <TaskListLoading />
    );
  }
  if (search.date && search.date !== today) {
    return (
      <FutureDayPage
        search={search}
        date={search.date}
        setSearch={setSearch}
        navigation={navigation}
        session={data}
        sessionError={error}
      />
    );
  }
  return (
    <TaskListPage
      title="Today"
      description="Finish today. Earlier unfinished plans and deadlines stay visible."
      scope="TODAY"
      search={search}
      setSearch={setSearch}
      navigation={navigation}
    />
  );
}
