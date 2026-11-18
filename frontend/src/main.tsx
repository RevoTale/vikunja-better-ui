import { ApolloProvider } from "@apollo/client/react";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { OfflineScreen } from "@/app/pwa/offline-screen";
import { registerOfflineShell } from "@/app/pwa/register";
import { router } from "@/app/router";
import { BrandMark } from "@/components/brand-mark";
import { Toaster } from "@/components/ui/toast";
import { watchSessionChanges } from "@/features/auth/session-change";
import { apolloClient } from "@/lib/apollo";
import { TimeFormatProvider } from "@/lib/time-format-context";
import "@/styles/global.css";

const root = document.getElementById("root");
const cspNonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
const offlineShell = document.querySelector('meta[name="offline-shell"]') !== null;
registerOfflineShell();

if (!root) {
  throw new Error("Application root is missing");
}

const app = createRoot(root);
watchSessionChanges((target) => {
  flushSync(() =>
    app.render(
      <main
        className="grid min-h-svh place-items-center"
        role="status"
        aria-label="Opening session"
      >
        <BrandMark className="size-10" />
      </main>,
    ),
  );
  apolloClient.stop();
  apolloClient.cache.restore({});
  if (target) window.location.replace(target);
  else window.location.reload();
});
app.render(
  <StrictMode>
    <CSPProvider nonce={cspNonce}>
      <ApolloProvider client={apolloClient}>
        <Toaster>
          {offlineShell ? (
            <OfflineScreen />
          ) : (
            <TimeFormatProvider>
              <RouterProvider router={router} />
            </TimeFormatProvider>
          )}
        </Toaster>
      </ApolloProvider>
    </CSPProvider>
  </StrictMode>,
);
