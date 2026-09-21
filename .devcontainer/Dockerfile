# syntax=docker/dockerfile:1.27.0

FROM ghcr.io/pnpm/pnpm:12.5.1 AS pnpm

FROM mcr.microsoft.com/devcontainers/base:trixie
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
