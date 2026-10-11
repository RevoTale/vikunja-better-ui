import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";

type LabelOption = { value: string; label: string };

export function TaskLabelCombobox({
  options,
  value,
  loading,
  onChange,
}: {
  options: LabelOption[];
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Combobox
      modal={false}
      items={options}
      value={options.find((option) => option.value === value) ?? null}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, selected) => option.value === selected.value}
      onValueChange={(option) => {
        if (option) onChange(option.value);
      }}
    >
      <ComboboxTrigger
        aria-label="Filter by label"
        render={
          <Button
            variant="outline"
            className="h-11 w-full min-w-0 justify-between rounded-md sm:h-9"
          />
        }
      >
        <span className="min-w-0 truncate">
          <ComboboxValue />
        </span>
      </ComboboxTrigger>
      <ComboboxContent aria-label="Label suggestions" className="min-w-0!">
        <ComboboxInput
          aria-label="Search labels"
          placeholder="Find a label"
          showTrigger={false}
          className="h-11! [&_input]:min-w-0 [&_input]:text-base sm:[&_input]:text-sm"
        />
        <ComboboxEmpty>{loading ? "Loading labels…" : "No labels found."}</ComboboxEmpty>
        <ComboboxList aria-label="Labels">
          {(option: LabelOption) => (
            <ComboboxItem key={option.value} value={option} className="min-h-11 sm:min-h-9">
              <span className="min-w-0 wrap-anywhere">{option.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
