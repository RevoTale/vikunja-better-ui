import { useQuery } from "@apollo/client/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionDocument } from "@/graphql/graphql";
import { type DaySearch, navigateDaySearch } from "./day-search";
import { FutureDayPage } from "./future-day-page";
import { ListMessage } from "./list-state";
import { currentDateInTimeZone } from "./local-date-time";
import { TaskListLoading } from "./task-list-loading";
import { TaskListPage } from "./task-list-page";

export function TodayPage({
  search,
  setSearch,
}: {
  search: DaySearch;
  setSearch: (next: DaySearch) => void;
}) {
  const { data, error } = useQuery(SessionDocument);
  const timezone = data?.session.vikunjaUser?.timezone;
  const today = timezone ? currentDateInTimeZone(timezone) : undefined;
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
      <ListMessage tone="error">Timezone could not be loaded. Refresh the page.</ListMessage>
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
      description="Due now or before the end of today."
      scope="TODAY"
      search={search}
      setSearch={setSearch}
      navigation={navigation}
    />
  );
}
