# Woodpecker CI

One workflow replaces the three GitHub Actions workflows. It provisions pinned
Go/pnpm tools and runs the existing Task gates on pull requests, `main`, and
`v*` release tags. Pull requests and `main` also run a no-push production-image
build. A release tag repeats every Task gate before the production image is
built and published. After a successful `main` push, an official Woodpecker
plugin maintains the release PR. Its release tag creates the multi-architecture
image and a GitHub Release with generated release notes. The shared workspace
carries toolchains and caches between containers; no host paths, Docker socket,
Docker-in-Docker service, or privileged steps are required. Go, pnpm and Node
images match the production build's pinned versions.

## One-time setup

1. Enable this GitHub repository in Woodpecker, using the default config path.
2. Enable pull-request and push hooks. Require approval for forked PRs before
   running code from contributors. The repository does not need to be trusted
   and its YAML does not request privileged mode. The CI agent must allow the
   exact pinned official Buildx plugin through
   `WOODPECKER_PLUGINS_PRIVILEGED=woodpeckerci/plugin-docker-buildx:6.1.2@sha256:d26b69cbe748b8a219c707e7889d5ffb3f9214bc3c480c30fe857ff85954267c`;
   this narrowly enables the builder runtime, not arbitrary privileged steps.
3. Set the repository timeout to 120 minutes. Enable cancellation of
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

`required-checks` installs the frozen frontend dependencies, then runs
`task gen:check`, `task validate`, and `task test:ci`. Pull requests then run
`e2e-pr`: a compact Chromium/WebKit browser matrix with the creation,
recurrence, task-editing, PWA, discussion and mobile/Safari-risk coverage.
Pushes to `main` and release tags run `e2e-full`, the complete browser matrix,
before their production image steps. `test:ci` executes the complete Go suite twice in shuffled order,
plus the frontend suite, but intentionally omits `-race`: the sole native
Woodpecker `linux/arm64` agent exposes a 47-bit virtual address space that the
Go 1.27.2 race runtime rejects before any test can start. `task test` retains
the twice-shuffled race suite for compatible developer hosts and must replace
`test:ci` once a Go release includes the upstream
[47-bit TSan fix](https://github.com/llvm/llvm-project/pull/220040).
`production-image` subsequently performs a no-push multi-platform Buildx build
on pull requests and `main`, validating the production Dockerfile without
Docker-in-Docker or privileged mode. The tag pipeline repeats
`required-checks`; only then does its production Buildx step publish the image.
`task image:smoke` remains the local release-candidate check: it starts an
isolated Vikunja info fixture and verifies the running image.

The official `ready-release-go` plugin keeps a reviewed release PR up to date.
It calculates the version from merged PR labels; merging that PR creates the
release tag. Only the resulting `v*` tag event can publish an image, so
ordinary `main` pushes cannot move `latest`. After that publish succeeds,
official `plugin-release` creates the matching GitHub Release with GitHub's
generated release notes. The release title can still be edited before merging
when a manual version is required.

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
[Docker Buildx plugin](https://woodpecker-ci.org/plugins/docker-buildx),
[Release plugin](https://woodpecker-ci.org/plugins/release), and
[Docker cross-compilation](https://docs.docker.com/build/building/multi-platform/#cross-compilation).
