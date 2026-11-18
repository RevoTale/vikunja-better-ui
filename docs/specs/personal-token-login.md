# Personal token login

[ADR-013](../decisions/0013-personal-token-login.md) records the accepted
design. For deployment settings and request paths see the
[configuration](../../README.md#configuration) and [access map](../architecture.md).

## Signing in and using the application

1. The operator configures one Vikunja server. The user creates a dedicated
   token in that server's **Settings → API Tokens**, selects the permissions
   for their work and can save it in a password manager. Vikunja shows the
   value once. [Vikunja API tokens](https://vikunja.io/help/settings/#api-tokens)
2. The user opens the deployment's HTTPS address or its private HTTP address
   over WireGuard and submits the token through the same-origin GraphQL login.
   Go verifies access to the owning profile with
   `GET /api/v2/user` (`other:user`). Failure to read the profile prevents
   login. A successful profile read says nothing about task write permissions.
   The form must support password-manager entry and keep the credential out
   of URLs, responses, logs, Apollo's cache and browser application storage.
3. Go sets two expiring, host-only cookies with `HttpOnly`, `SameSite=Lax`
   and path `/`. HTTPS uses `__Host-vbu_session`
   with `Secure` as the active session selector. HTTP uses `vbu_session`
   without `Secure`. A second cookie with the selector’s session ID in its
   name carries the encrypted token and expires after 30 days. Renewal after
   day 15 and revocation update only that credential, so a delayed response
   from a previous account cannot replace the active login. The selector
   carries no credential. It lasts at most 400 days from login, after which
   the user signs in again. Bind the credential to both the trusted browser origin
   and the configured Vikunja transport URL, including its base path. Encrypt the
   personal token and session metadata together. Derive a distinct
   encryption key from the deployment secret and keep CSRF and action
   capabilities bound to the session. Retain the existing session lifetime
   and refresh policy described in the [MVP contract](mvp.md#session).
4. On subsequent private requests Go opens the cookie and calls the configured
   upstream with the personal token. This includes activity, GraphQL mutations,
   project lists, avatars and binary attachments. Vikunja enforces both the
   token's operations and the owner's access to the resource. Keep a permission
   denial for one feature distinct from a lost session or an upstream outage.
   Vikunja 2.8 can return the same 401 for a missing route permission and a
   revoked token. Only on that response, Go checks the same token via
   `GET /api/v2/token/test`. A valid token keeps its session, a confirmed
   invalid token requires sign-in, and an inconclusive probe leaves the
   session available for retry. The original operation is never replayed.
   [Upstream middleware](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/routes/api_tokens.go#L93-L125) · [Probe contract](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/routes/api/v2/token_meta.go#L51-L64)
5. On sign-out clear the cookie and private in-memory client data. Account
   switching, including in a second tab, must not show the previous user's
   tasks or drafts. Separate cached or in-flight upstream reads by credential.
   A saved link identifies a task. The recipient opens it with their own access.

Example: two people can edit a shared project in Vikunja. One gives Better UI
a token limited to profile, project and task reads. Both can see the task.
Only the person whose token also permits task updates can complete it. Use a
disposable one-time task to verify this behavior.

## Deployment configuration

| Setting | Behavior |
| --- | --- |
| `APP_VIKUNJA_URL` | Required. Every private browser session, Jobs caller and MCP caller uses this configured upstream. Changing this address requires browser users to sign in again. |
| `APP_SESSION_SECRET` | Required. Keep the same strong secret, encoding and compatible cookie format across replicas and redeployments. Keep the secret outside the image. |
| `APP_ALLOWED_ORIGIN` | Optional when the deployment can establish its trusted browser origin. Accept HTTPS and private HTTP over WireGuard, including an IP and port. Set the origin explicitly when integrations need a fixed browser-facing URL or the deployment cannot establish it otherwise. |
| `APP_VIKUNJA_PUBLIC_URL` | Set to the browser-facing HTTPS address of native Vikunja if the Go transport uses internal HTTP in production. It defaults to the upstream URL otherwise. |
| `APP_VIKUNJA_API_TOKEN` | Required only when `APP_PUBLIC_ACTIVITY_ENABLED` or `PUBLIC_ALL_TIME_ACTIVITY` enables an anonymous aggregate. Use a dedicated token with `other:user` and `tasks:read_all`. Private operations never fall back to it. |
| `APP_AUTH_USERNAME`, `APP_AUTH_PASSWORD` | The personal-token login has no deployment-wide user or password. |
| `APP_PUBLIC_URL` | Explicit canonical URL and search-indexing opt-in. A private installation may leave it unset. |

Other runtime settings and feature defaults follow the
[configuration reference](../../README.md#configuration). Readiness checks the upstream version at `/api/v2/info` without a token. Both public flags may be off.

## Browser origin and links

An origin is the scheme, hostname or IP, and port **as opened by the browser**.
For a private HTTP deployment, `APP_ALLOWED_ORIGIN=http://10.77.0.20:8080`
or `http://[fd00::20]:8080` requires no TLS certificate. On HTTPS, for
example `https://10.77.0.20:8443`, the client must trust a certificate for that IP.
WireGuard encrypts traffic between its peers. If the tunnel terminates on a
separate gateway, the hop from that gateway to Go carries the login token and
session cookie over plain HTTP and must be trusted. Cookies are shared across
ports on the same host, so use an HTTP host whose services can be trusted with
the session cookie.

Choose the cookie policy from the trusted external scheme, including when
HTTPS terminates at a proxy and the proxy connects to Go over HTTP. A client
header cannot downgrade an HTTPS deployment. On a non-loopback HTTP IP,
ordinary online task workflows must work without secure-context browser
APIs. Service-worker offline launch requires HTTPS there. When native sharing
and clipboard access are unavailable, show the existing manual link dialog.
[Cookie attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) ·
[PWA behavior](../pwa.md) · [Share links](share-links.md)

Set `APP_ALLOWED_ORIGIN` to pin the browser address, including behind TLS
termination. When it is empty in production, Go first uses an explicitly
configured `APP_PUBLIC_URL`. Otherwise Go constructs the origin from the
actual private or loopback TCP destination and checked HTTP Host. The port
must match the socket, and the scheme reflects TLS on that connection.
GraphQL rejects absent, duplicate, null and mismatched Origin values, including
on login. An external DNS name, forwarded TLS or translated port needs a
pinned origin. Forwarded host and scheme headers never supply that trust.

Use the trusted browser address for task-reference recognition and for links
returned by Jobs. For example, Glance might call Go by an internal service
name while the phone needs `https://10.77.0.20:8443/tasks/42`. That deployment
can set `APP_ALLOWED_ORIGIN` explicitly. A submitted task link or an MCP
caller's headers cannot establish a trusted origin. Automatic discovery must
never enable indexing. [Jobs contract](../decisions/0004-read-only-jobs-integration.md) ·
[Public activity](../decisions/0008-public-activity-http-cache.md)

## Cutover and recovery

- Keep the running version's old configuration until upgrading to a release
  that implements this contract. At cutover the new version rejects the old
  signed cookies and replaces them when the user signs in with a personal token. An old cookie cannot establish
  which personal credential to use.
- Keep the previous image reference and its required configuration available
  for rollback. The previous image requires app login for users carrying a
  new-format cookie. Unexpired legacy cookies can still validate on the old
  image if its original secret is restored. Tasks and history stay in Vikunja.
- For a lost device, revoke its API token in Vikunja. Other devices using that
  token will need a new one. For a compromised deployment secret, replace it
  across replicas, invalidate affected sessions and revoke any upstream tokens
  that may have been exposed. Replacing the secret alone does not revoke
  credentials already obtained from a cookie.

## Acceptance evidence

On 2026-11-18 the personal-token revision based on `9f2ca27` was exercised
against an isolated Vikunja 2.8.0. Chromium opened the production app on
a private, non-loopback HTTP address, signed in, reopened a task after a
same-key restart, shared its link, completed it and signed out. A replacement
key required login. The Chromium/WebKit PR run passed all 23 scenarios,
including missing profile permission, a denied write with continued read
access, and switching users in another tab. Go tests also delivered a delayed
credential renewal and revocation after a second login and after logout.
[Browser scenarios](../../frontend/e2e/private-http.spec.ts) · [Access tests](../../frontend/e2e/personal-token.spec.ts) · [Cookie ordering](../../internal/auth/session_ordering_test.go)

The local Linux/arm64 image smoke tested a private installation without a
global token or explicit browser origin. The deployed WireGuard route,
off-VPN reachability and installation on a physical phone still need checking.

Use these scenarios when releasing or deploying. The Go and Playwright suites
cover application behavior. Verify actual routing and device permissions on the
deployment and record the tested image, client and observed result.

| Where | Scenario | Expected result |
| --- | --- | --- |
| Isolated Vikunja, two users | Sign in concurrently with different project access. Open the same task and attachment link from each account. | Each sees only permitted data. Private requests never use the public aggregate token. |
| Browser, same device | Sign out as A and sign in as B. Repeat with A's task open in another tab and with a pending request. | B cannot see or act on A's tasks, cached results, drafts or Undo capability. |
| Isolated Vikunja | Attempt an update with a read-only token, then a read. Repeat after revoking the token. | The denied write changes nothing. Reading still works until the token is revoked. |
| Deployment fixture | Redeploy with the same browser origin, upstream and key, then change the key or upstream. Submit an old pre-migration cookie. | A compatible session survives the first redeploy. Changing the key or upstream requires a fresh login, as does presenting a legacy cookie. |
| Deployment fixture | Start private-only with no global token. Enable each public flag independently. Exercise Jobs and MCP with their own tokens. | Private-only startup and readiness succeed. Enabled snapshots require their own configured credential. Jobs and MCP retain caller permissions. |
| Proxy and browser | Try exact, mismatched, missing and null origins, a nondefault port and untrusted forwarded headers. | Only the verified same-origin request succeeds. A client-supplied header cannot set the target for absolute links. |
| Browser and TLS proxy | Open the HTTPS address through a proxy with an HTTP upstream. Repeat with a client-supplied forwarded scheme. | The HTTPS session always requires its Secure cookie. An HTTP session or a forged header cannot downgrade it. |
| Actual WireGuard client | On a private HTTP deployment open `http://10.77.0.20:8080`, sign in, reload, open a Jobs link, complete a permitted task and sign out. Repeat on an HTTPS deployment. | Both origins support online work and enforce the phone user's rights. Sign-out clears the applicable cookie. The HTTPS certificate is trusted. A VPN-only installation is unreachable off VPN. |
