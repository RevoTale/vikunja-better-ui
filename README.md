# Vikunja Better UI

A small alternative client for Vikunja, built around the workflows I actually
use.

The main focus is recurring tasks. The standard client makes common recurring
task actions repetitive and unclear. This project removes that boilerplate and
keeps the behavior predictable. It is not intended to copy every Vikunja
feature or become another general project-management system.

## AI-made only

This repository is made only through AI agents.

I define the product direction, constraints, and accepted decisions. AI agents
write the code, tests, and documentation. This is intentional and applies to
the whole repository.

## Architecture

```text
React UI -> Go GraphQL API -> Vikunja REST API
```

- React, TypeScript, Vite, Apollo Client, and pnpm on the frontend.
- Go and gqlgen on the backend.
- The Go binary embeds and serves the static frontend.
- App login uses a username and password from environment variables.
- Vikunja access uses an API token from an environment variable.
- The browser never receives the Vikunja API token.

## Status

The project is currently being defined and scaffolded. Setup and usage
instructions will be added when there is a runnable application.

See [AGENTS.md](AGENTS.md) for the accepted project rules and structure.
