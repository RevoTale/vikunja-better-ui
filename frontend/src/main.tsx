import { ApolloProvider } from "@apollo/client/react";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router } from "@/app/router";
import { Toaster } from "@/components/ui/toast";
import { apolloClient } from "@/lib/apollo";
import "@/styles/global.css";

const root = document.getElementById("root");
const cspNonce = document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;

if (!root) {
  throw new Error("Application root is missing");
}

createRoot(root).render(
  <StrictMode>
    <CSPProvider nonce={cspNonce}>
      <ApolloProvider client={apolloClient}>
        <Toaster>
          <RouterProvider router={router} />
        </Toaster>
      </ApolloProvider>
    </CSPProvider>
  </StrictMode>,
);
