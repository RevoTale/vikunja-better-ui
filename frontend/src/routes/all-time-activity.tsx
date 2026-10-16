import { createFileRoute } from "@tanstack/react-router";
import { AllTimeActivityPage } from "@/features/activity/all-time-activity-page";

export const Route = createFileRoute("/all-time-activity")({ component: AllTimeActivityPage });
