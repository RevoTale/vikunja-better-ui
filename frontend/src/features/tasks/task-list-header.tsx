import type { ReactNode } from "react";
import type { ProjectsQuery } from "@/graphql/graphql";
import type { ListSearch } from "./list-search";
import { TaskListFilters } from "./task-list-filters";

export function TaskListHeader({
  title,
  description,
  projects,
  supportsLabels,
  supportsPriority,
  search,
  setSearch,
  navigation,
}: {
  title: string;
  description: string;
  projects: ProjectsQuery["projects"]["items"];
  supportsLabels: boolean;
  supportsPriority: boolean;
  search: ListSearch;
  setSearch: (search: ListSearch) => void;
  navigation?: ReactNode;
}) {
  return (
    <div>
      <div>
        <h1 id="page-title" className="font-serif text-3xl font-semibold">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {navigation}
      <TaskListFilters
        projects={projects}
        supportsLabels={supportsLabels}
        supportsPriority={supportsPriority}
        search={search}
        setSearch={setSearch}
      />
    </div>
  );
}
