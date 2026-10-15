# Woodpecker CI

One workflow replaces the three GitHub Actions workflows. It provisions pinned
Go/pnpm tools and runs the existing Task gates on pull requests and `main`.
After a successful `main` push, an official Woodpecker plugin maintains the
release PR. Its release tag starts a separate tag pipeline that publishes the
multi-architecture image through an official Woodpecker plugin. The shared
workspace carries toolchains and caches between containers; no host paths,
Docker socket, Docker-in-Docker service, or privileged steps are required. Go,
pnpm and Node images match the production build's pinned versions.

## One-time setup

1. Enable this GitHub repository in Woodpecker, using the default config path.
2. Enable pull-request and push hooks. Require approval for forked PRs before
   running code from contributors. The repository does not need to be trusted
   and its YAML does not request privileged mode. The CI agent must allow the
   exact pinned official Buildx plugin through
   `WOODPECKER_PLUGINS_PRIVILEGED=woodpeckerci/plugin-docker-buildx:6.1.2`;
   this narrowly enables the builder runtime, not arbitrary privileged steps.
3. Set the repository timeout to at least 45 minutes. Enable cancellation of
   previous **pull-request** pipelines, not `main` release pipelines.
4. Add the protected `github_token` secret, enabled for push and tag events
   only, never PR events. It is a classic PAT owned by `l-you`, with `repo` and
   `write:packages`; authorize organization SSO if required. It creates/updates
   release PRs, tags, releases and images. The GHCR username is the public
   token owner (`l-you`) and is fixed in the workflow, so no second secret is
   needed.
5. After the first Woodpecker run, replace the old `Required checks` GitHub
   Actions status in `main` branch protection with the actual Woodpecker status.
   Do not remove the requirement for successful checks.

These are server/repository settings, not changes the YAML can apply for you.

## Checks and releases

`required-checks` installs the frozen frontend dependencies and both Playwright
browsers, then runs `task gen:check`, `task validate`, `task test`, and
`task e2e`. `production-image` subsequently performs a no-push multi-platform
Buildx build, validating the production Dockerfile without Docker-in-Docker or
privileged mode. `task image:smoke` remains the local release-candidate check:
it starts an isolated Vikunja info fixture and verifies the running image.

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
