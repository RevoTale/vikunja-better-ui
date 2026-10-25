import { createFileRoute } from "@tanstack/react-router";
import { MorePage } from "@/features/navigation/more-page";

export const Route = createFileRoute("/_authenticated/more")({ component: MorePage });
