import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditorToolButton({
  label,
  icon: Icon,
  active,
  disabled,
  compact = false,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      className="min-h-11 min-w-11 aria-pressed:inset-ring aria-pressed:inset-ring-primary"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className={compact ? "sr-only" : undefined}>{label}</span>
    </Button>
  );
}
