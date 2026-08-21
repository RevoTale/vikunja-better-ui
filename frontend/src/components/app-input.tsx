import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AppInput({ className, ...props }: ComponentProps<typeof Input>) {
  return <Input className={cn("h-11 rounded-md px-3 shadow-xs", className)} {...props} />;
}
