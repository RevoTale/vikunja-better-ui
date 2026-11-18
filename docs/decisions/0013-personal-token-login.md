# ADR-013: Authenticate browser users with personal Vikunja API tokens

## Status

Accepted and implemented on 2026-11-18. [Login contract and acceptance](../specs/personal-token-login.md) ·
[Current architecture](../architecture.md)

## Context

Several people want to use the same Better UI installation over WireGuard.
Each should see the projects their Vikunja account can access and perform only
the actions allowed by the token they give Better UI. The original
[MVP login](../specs/mvp.md#authentication-and-security) gives every browser
the same configured Vikunja identity. Device access to the VPN cannot express
individual project or token permissions.

The user wants to keep Go as the only Vikunja API client, retain sessions
across redeployments and avoid a server-side credential or session database.
The reason to offer password-manager storage is to make the next sign-in easy.

## Decision

- Configure one upstream URL for the installation. Let each browser user submit
  a personal API token issued in Vikunja. One user's read-only token must still
  give read-only access when their Vikunja account can edit the project.
- Have Go authenticate and encrypt the expiring browser session, including its
  upstream token, using AES-GCM. Keep a stable deployment secret across replicas
  and redeployments. The browser carries the cookie. The user's password manager
  can retain the credential for a later login.
- Use that person's token for all private reads, writes and attachment downloads.
  Reserve a separately configured read-only token for enabled anonymous
  aggregates. Jobs and MCP preserve their own caller-token contracts.
- Support deployment by DNS name or IP over HTTPS, including a nondefault port.
  Allow omission of `APP_ALLOWED_ORIGIN` when the external origin can be
  established safely. The [origin contract](../specs/personal-token-login.md#browser-origin-and-links)
  records the constraints and the pending deployment checks.

## Clarification — 2026-11-18

The user also needs to open Better UI directly at an HTTP address over
WireGuard. This expands the original HTTPS-only browser decision above.
A private production deployment must support an origin such as
`http://10.77.0.20:8080` without a certificate or a switch to development
mode. A user can sign in, refresh the page, open a task from Glance and sign
out at that address. HTTPS deployments keep their Secure cookie. See the
[transport and session requirements](../specs/personal-token-login.md#browser-origin-and-links).

## PWA access — 2026-11-18

The user wants one online interface on a WireGuard IP, including phones,
without provisioning TLS solely for Better UI. Keep login, task navigation,
manual link sharing and logout available at the HTTP address. The browser
enables service workers only on secure contexts. Offline launch and browser
installation capabilities are described in the [PWA guide](../pwa.md).

## Concurrent account changes — 2026-11-18

A slow request started before switching accounts can finish after the next
login. Give each login its own encrypted credential cookie. Only explicit
login and logout select the active identity. Late refresh and revocation
responses can then affect only the credential that started the request. The
selector has no token and expires within 400 days. See the [session contract](../specs/personal-token-login.md).

## Alternatives considered


Separate Better UI installations naturally isolate credentials, but make each
person maintain or depend on their own deployment. Registering multiple
upstream URLs solves a different problem. The requested users share one Vikunja.

A signed JWT containing a user ID leaves Go needing somewhere to retrieve the
upstream token. Putting that token in a signed-only payload exposes it to
anyone who can read the payload. JWE would provide encryption and a portable
format. Only this Go service consumes the session, so the standard library's
authenticated encryption is sufficient. A server-side session registry would
support immediate per-session revocation at the cost of persistent state.
[Go AES-GCM](https://pkg.go.dev/crypto/cipher#NewGCMWithRandomNonce)

A browser OAuth flow would remove the manual token step. Vikunja 2.8.0 accepts
native application schemes and HTTP loopback callbacks. It rejects the hosted
Better UI HTTPS callback. It also issues an ordinary user session without a
per-client selection of API operations. Revisit this option if upstream adds
both capabilities. [Redirect validation](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/modules/auth/oauth2server/client.go#L25-L52) ·
[Authorization request](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/modules/auth/oauth2server/authorize.go#L29-L37) ·
[Session issuance](https://github.com/go-vikunja/vikunja/blob/v2.8.0/pkg/modules/auth/oauth2server/token.go#L141-L178)

## Token errors — 2026-11-18

Testing a real read-only token showed that Vikunja 2.8 returns the same HTTP
401 for insufficient route permissions and for revocation. A read-only user
should be able to keep reading after a denied write. Confirm token validity
with the upstream’s scope-independent check before deciding whether to end a
session. Never replay the attempted write. [Protocol and acceptance](../specs/personal-token-login.md)

## Changing the upstream — 2026-11-18

A deployment can point the same browser origin at another Vikunja server.
Bind each encrypted browser credential to `APP_VIKUNJA_URL`, including its
base path, so changing the target requires a new login before forwarding a
personal token. Redeploying against the same upstream with the same secret
preserves the session. [Migration and recovery](../specs/personal-token-login.md#cutover-and-recovery)

## Consequences

At cutover, users must sign in with a personal token because existing cookies
carry no upstream credential. Later compatible redeployments can preserve new
sessions. Logout clears the local cookie. A copied cookie can authorize
requests while valid and while Vikunja accepts the enclosed token. Revoking
the token in Vikunja cuts off subsequent upstream access for all sessions that
use it. Separate per-device tokens permit independent revocation.
