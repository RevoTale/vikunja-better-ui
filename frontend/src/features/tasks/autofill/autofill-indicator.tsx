import { FieldDescription } from "@/components/ui/field";

export function AutofillIndicator({ id }: { id: string }) {
  return (
    <FieldDescription id={id} className="text-xs">
      From last task
    </FieldDescription>
  );
}
