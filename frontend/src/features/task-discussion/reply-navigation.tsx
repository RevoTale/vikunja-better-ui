import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReplyNavigation({ depth, onBack }: { depth: number; onBack: () => void }) {
  return (
    <nav aria-label="Reply chain" className="flex flex-wrap items-center gap-2 text-sm">
      <Button variant="outline" className="min-h-11" onClick={onBack}>
        <ArrowLeftIcon aria-hidden="true" /> Back to reply
      </Button>
      <span role="status" className="text-muted-foreground">
        Reply chain · {depth} {depth === 1 ? "step" : "steps"}
      </span>
    </nav>
  );
}
