import type { ReactNode } from "react";
import { AppSelect } from "@/components/app-select";
import type { ProjectsQuery } from "@/graphql/graphql";
import type { ListSearch } from "./list-search";
import { TaskLabelFilter } from "./task-label-filter";

export function TaskListHeader({
  title,
  description,
  projects,
  supportsLabels,
  search,
  setSearch,
  navigation,
}: {
  title: string;
  description: string;
  projects: ProjectsQuery["projects"]["items"];
  supportsLabels: boolean;
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
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:flex sm:max-w-md">
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
            onChange={(label) =>
              setSearch({ project: search.project, page: 1, ...(label !== "all" ? { label } : {}) })
            }
          />
        ) : null}
      </div>
    </div>
  );
}
