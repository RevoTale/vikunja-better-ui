import { useApolloClient, useMutation, useQuery } from "@apollo/client/react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  History,
  LogOut,
  Plus,
  TimerOff,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { createActionForPath } from "@/features/tasks/create-action";
import { LogoutDocument, SessionDocument } from "@/graphql/graphql";
import { setCSRFToken } from "@/lib/apollo";
import { cn } from "@/lib/cn";

const navigation = [
  { to: "/today", label: "Today", mobileLabel: "Today", icon: CheckCircle2 },
  { to: "/week", label: "Week", mobileLabel: "Week", icon: CalendarDays },
  { to: "/month", label: "Month", mobileLabel: "Month", icon: CalendarRange },
  { to: "/jobs", label: "Jobs", mobileLabel: "Jobs", icon: BriefcaseBusiness },
  { to: "/unscheduled", label: "No deadline", mobileLabel: "No date", icon: TimerOff },
  { to: "/history", label: "History", mobileLabel: "History", icon: History },
] as const;

export function AppShell() {
  const apollo = useApolloClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = useQuery(SessionDocument);
  const [logout, { loading }] = useMutation(LogoutDocument);

  async function signOut() {
    const csrfToken = data?.session.csrfToken;
    if (!csrfToken) return;
    await logout({ variables: { csrfToken } });
    setCSRFToken(undefined);
    await apollo.clearStore();
    await navigate({ to: "/login", search: { returnTo: "/today" }, replace: true });
  }

  const returnTo = `${location.pathname}${location.searchStr}`;
  const createAction = createActionForPath(location.pathname);

  return (
    <div className="min-h-svh bg-background lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar p-4 lg:flex lg:flex-col">
        <Brand />
        <nav className="mt-8 grid gap-1" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavigationLink key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto grid gap-2">
          <Button variant="ghost" className="justify-start" onClick={signOut} disabled={loading}>
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>
      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden">
            <Brand />
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {data?.session.vikunjaUser?.username}
          </p>
          <Link
            className={cn(buttonVariants({ size: "compact" }))}
            to="/tasks/new"
            search={{ type: createAction.type, returnTo }}
          >
            <Plus /> {createAction.label}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t bg-background lg:hidden"
        aria-label="Main navigation"
      >
        {navigation.map((item) => (
          <NavigationLink key={item.to} {...item} compact />
        ))}
      </nav>
    </div>
  );
}

function Brand() {
  return <span className="font-serif text-lg font-semibold tracking-tight">Better Vikunja</span>;
}

function NavigationLink({
  to,
  label,
  mobileLabel,
  icon: Icon,
  compact = false,
}: (typeof navigation)[number] & { compact?: boolean }) {
  return (
    <Link
      to={to}
      search={{ project: "all", page: 1 }}
      className={cn(
        "flex items-center gap-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        compact ? "min-h-16 flex-col justify-center gap-1 px-1 text-[0.65rem]" : "min-h-11 px-3",
      )}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className={cn(compact && "whitespace-nowrap")}>{compact ? mobileLabel : label}</span>
    </Link>
  );
}
