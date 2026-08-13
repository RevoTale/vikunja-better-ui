import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import type { RouterContext } from "@/app/router";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

function RootLayout() {
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">This route does not exist.</p>
      </div>
    </main>
  );
}
