import { AppSelect } from "@/components/app-select";
import type { ProjectsQuery } from "@/graphql/graphql";
import type { ListSearch } from "./list-search";
import { TaskLabelFilter } from "./task-label-filter";
import { taskPriorityOptions } from "./task-priority";

export function TaskListFilters({
  projects,
  supportsLabels,
  supportsPriority,
  search,
  setSearch,
}: {
  projects: ProjectsQuery["projects"]["items"];
  supportsLabels: boolean;
  supportsPriority: boolean;
  search: ListSearch;
  setSearch: (search: ListSearch) => void;
}) {
  return (
    <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:max-w-2xl sm:flex-wrap">
      <AppSelect
        aria-label="Project"
        className="sm:h-9! sm:w-48"
        value={search.project}
        options={[
          { value: "all", label: "All projects" },
          ...projects.map((project) => ({ value: project.id, label: project.title })),
        ]}
        onValueChange={(project) => setSearch({ ...search, project, page: 1 })}
      />
      {supportsLabels ? (
        <TaskLabelFilter
          className="mt-0 sm:w-48"
          value={search.label ?? "all"}
          onChange={(label) => {
            const { label: _label, ...filters } = search;
            setSearch({ ...filters, page: 1, ...(label !== "all" ? { label } : {}) });
          }}
        />
      ) : null}
      {supportsPriority ? (
        <AppSelect
          aria-label="Filter by priority"
          className={`${supportsLabels ? "col-span-2 " : ""}sm:h-9! sm:w-48`}
          value={search.priority ?? "all"}
          options={[{ value: "all", label: "All priorities" }, ...taskPriorityOptions]}
          onValueChange={(priority) => {
            const { priority: _priority, ...filters } = search;
            setSearch({ ...filters, page: 1, ...(priority !== "all" ? { priority } : {}) });
          }}
        />
      ) : null}
    </div>
  );
}
