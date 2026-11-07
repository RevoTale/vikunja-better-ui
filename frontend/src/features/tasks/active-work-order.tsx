import { Pin } from "lucide-react";
import { AppSelect, type AppSelectOption } from "@/components/app-select";
import { Button } from "@/components/ui/button";
import type { ActiveWorkSort } from "@/graphql/graphql";
import { type ListSearch, parseListSearch } from "./list-search";

const sortOptions = [
  { value: "END_ASC", label: "Finish · earliest first" },
  { value: "END_DESC", label: "Finish · latest first" },
  { value: "START_ASC", label: "Start · earliest first" },
  { value: "START_DESC", label: "Start · latest first" },
  { value: "LABEL_ASC", label: "Label · A to Z" },
  { value: "LABEL_DESC", label: "Label · Z to A" },
] as const satisfies readonly AppSelectOption<ActiveWorkSort>[];

type ActiveSearch = ListSearch & { sort?: ActiveWorkSort; revisitFirst?: true };

export function parseActiveSearch(input: Record<string, unknown>): ActiveSearch {
  const sort = sortOptions.find((option) => option.value === input["sort"])?.value;
  const revisit = input["revisitFirst"];
  return {
    ...parseListSearch(input),
    ...(sort && sort !== "END_ASC" ? { sort } : {}),
    ...(revisit === true || revisit === "true" ? { revisitFirst: true } : {}),
  };
}

export function ActiveWorkOrderControls({
  search,
  onChange,
}: {
  search: ActiveSearch;
  onChange: (next: ActiveSearch) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
      <legend className="sr-only">Active work order</legend>
      <AppSelect
        aria-label="Sort active work"
        className="w-auto max-w-full sm:h-9!"
        value={search.sort ?? "END_ASC"}
        options={sortOptions}
        onValueChange={(sort) => onChange(parseActiveSearch({ ...search, page: 1, sort }))}
      />
      <Button
        type="button"
        variant={search.revisitFirst ? "secondary" : "outline"}
        className="min-h-11 sm:min-h-9"
        aria-pressed={Boolean(search.revisitFirst)}
        onClick={() =>
          onChange(parseActiveSearch({ ...search, page: 1, revisitFirst: !search.revisitFirst }))
        }
      >
        <Pin aria-hidden="true" className={search.revisitFirst ? "fill-current" : undefined} />
        Revisit first
      </Button>
    </fieldset>
  );
}
