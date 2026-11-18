# Installed app and offline shell

Better Vikunja opens on **Today** when installed. Existing installations may keep
their previous launch URL until the platform refreshes installed metadata.
The manifest includes PNG icons
at 192 and 512 pixels, a separate padded maskable icon, and the shared SVG icon.
iOS uses the opaque 180-pixel Apple touch icon. All derive from the same logo.
The navigation and main content respect device safe-area insets.
The top inset also contributes to scroll positioning, keeping Today and reply
targets below the taller sticky header on notched screens.

The [manifest](../frontend/public/site.webmanifest) uses `/today` for both its
installation identity and its launch URL.

## Opening over WireGuard

Open the deployment's HTTP address from the connected device, for example
`http://10.77.0.20:8080`. The online interface, manifest, icons and same-origin
token sign-in use the address you opened. You can save a bookmark or use the
browser's home-screen action when offered. Installation and standalone display
on a plain HTTP origin depend on the browser and OS.

Browsers normally restrict service workers, native sharing and clipboard access
on a non-loopback HTTP address. WireGuard provides the network transport. Better
UI opens online without a worker and offers a selectable link when automatic
sharing is unavailable.

## Cache without stale tasks

The production build attempts worker registration when the browser exposes the
API (typically HTTPS or localhost).
It downloads a versioned copy of the public app shell and build assets after
the page loads. Repeat visits reuse cached JavaScript, CSS, fonts and icons.
HTML remains network-first so online navigation receives current HTML and
security headers. The favicon and manifest keep their 10-minute HTTP cache
policy online; offline they can use the installed build's copy.

When a navigation cannot reach the server, the saved shell shows **You're
offline** and **Retry connection**. Reconnecting and choosing it loads the normal
app and checks authentication again. This is not offline task access: GraphQL,
session responses, task data and attachment media never enter the service-worker
cache. There is no mutation queue or offline completion/editing. Existing
discussion draft recovery is independent and unchanged.

Fatal route and initial-data failures expose **Reload page** with a reload icon,
so an installed iOS app does not depend on browser chrome or the task manager.
Where a safe request-level recovery exists, **Try again** appears first and keeps
the current document and drafts in place; full reload remains the fallback.

An already open editor is not replaced when connectivity changes. Its existing
request/error handling preserves edits; no automatic reload is triggered.
The offline document gets a fresh matching CSP nonce and retains the saved
security policy. It contains no user data.

## Updates and limits

Each build has its own cache. Installation succeeds only when all listed files
are available and the HTML matches the build. A failed installation leaves the
previous build intact. A new worker waits until all tabs using the old worker
close; it never forces a refresh or discards a draft. Close all app tabs/windows
and reopen to activate a downloaded update. Obsolete app caches are removed on
activation; unrelated origin caches are untouched.

The first visit needs a connection. Browsers may evict stored files, deny cache
storage in private mode, or differ in install UI. Online use continues if worker
registration fails. Uninstall/clearing site data removes the offline copy.
If cache reads fail after installation, public assets fall back to the network;
offline startup still requires an accessible cached shell.
The service worker is not registered by the Vite development server; use the
production-built `task demo` preview to test it.

Regenerate the checked-in install PNGs after changing `frontend/public/favicon.svg`
with `node e2e/render-icons.mjs` from `frontend/` in the Dev Container. This uses
the existing Playwright Chromium installation; normal builds require no browser.

Browser regression coverage checks offline deep links, recovery controls, cache boundaries
and CSP consistency. Unit tests cover rejected/partial installations and cache
cleanup. Physical iOS installation and home-screen cropping still require a
real-device check; WebKit automation is not a substitute for that check.

The normal E2E suite blocks service workers so Playwright's deliberate network
delays and failures remain interceptable. PWA specs explicitly enable real
workers and simulate connection loss through an isolated origin, including on
WebKit. No application code changes behavior for tests.
