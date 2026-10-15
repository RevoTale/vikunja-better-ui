# Woodpecker CI

One workflow replaces the three GitHub Actions workflows. It provisions pinned
Go/pnpm tools and runs the existing Task gates on pull requests and `main`.
After a successful `main` push, an official Woodpecker plugin maintains the
release PR. Its release tag starts a separate tag pipeline that publishes the
multi-architecture image through an official Woodpecker plugin. The shared
workspace carries toolchains and caches between containers; no host paths or
Docker socket are mounted. Go, pnpm and Node images match the production build's
pinned versions.

## One-time setup

1. Enable this GitHub repository in Woodpecker, using the default config path.
2. Enable pull-request and push hooks. Require approval for forked PRs before
   running code from contributors. Use a dedicated CI agent: Docker-in-Docker
   requires trusted **security** permission for the privileged Docker service.
   Keep Docker's unauthenticated port private to the pipeline network; do not
   publish it on the agent host. Trusted host-volume access is not needed.
3. Set the repository timeout to at least 45 minutes. Enable cancellation of
   previous **pull-request** pipelines, not `main` release pipelines.
4. Add the protected secrets `github_token` and `github_username`, enabled for
   push and tag events only, never PR events. `github_token` is a classic PAT
   owned by an account allowed to publish this GHCR package, with `repo` and
   `write:packages`; authorize organization SSO if required. It creates/updates
   release PRs, tags, releases and images. `github_username` is that token
   owner's GitHub login, required by GHCR; it is deliberately not hardcoded.
5. After the first Woodpecker run, replace the old `Required checks` GitHub
   Actions status in `main` branch protection with the actual Woodpecker status.
   Do not remove the requirement for successful checks.

These are server/repository settings, not changes the YAML can apply for you.

## Checks and releases

`required-checks` installs the frozen frontend dependencies and both Playwright
browsers, then runs `task gen:check`, `task validate`, `task test`, `task e2e`,
and `task image:smoke`. The image smoke-test starts a minimal isolated Vikunja
info fixture for the startup version check; it does not contact production.
Its temporary containers and network are removed on success or failure.
`SMOKE_PROBE_HOST=docker` and `SMOKE_PUBLISH_HOST=0.0.0.0` address the isolated
DinD daemon; local smoke-tests retain loopback binding by default.

The official `ready-release-go` plugin keeps a reviewed release PR up to date.
It calculates the version from merged PR labels; merging that PR creates the
release/tag. Only the resulting tag event can publish an image, so ordinary
`main` pushes cannot move `latest`. `plugin-docker-buildx` publishes the exact
tag and `latest` with the configured GHCR credentials. The release title can
still be edited before merging when a manual version is required.

Use the plugin's default PR labels for version selection: `breaking` for a
major release, `feature` or `enhancement` for a minor release, and `bug`,
`docs`, `dependencies`, or `chore` for a patch release. This replaces the
former Release Please conventional-commit configuration; no repository-specific
release script is maintained.

Multi-platform Docker builds use native build stages and Go cross-compilation;
the final distroless image is unchanged. Neither QEMU nor host binfmt changes
are needed. Nothing is published from PRs or from separate tag events.

## Diagnostics and verification

Playwright retains traces, screenshots and reports in the usual workspace
paths and prints failures in Woodpecker logs. GitHub's seven-day artifact upload
is **not** replicated: persistent browser artifacts require a separately
configured Woodpecker artifact-storage plugin/bucket. `github_token` alone does
not provide that storage. Without it, workspace files disappear after the run.

Validate YAML with `woodpecker-cli lint .woodpecker.yaml`. A real Woodpecker run
is necessary to verify agent permissions, webhook delivery, protected-secret
scope, release labels and GHCR access.

Official references: [workflow syntax](https://woodpecker-ci.org/docs/usage/workflow-syntax),
[repository settings](https://woodpecker-ci.org/docs/usage/project-settings),
[Ready release go](https://woodpecker-ci.org/plugins/ready-release-go),
[Docker Buildx plugin](https://woodpecker-ci.org/plugins/docker-buildx), and
[Docker cross-compilation](https://docs.docker.com/build/building/multi-platform/#cross-compilation).
