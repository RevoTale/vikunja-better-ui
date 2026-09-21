# syntax=docker/dockerfile:1.27.0@sha256:bde3983e9c939224420ddaf6b784cc30e09b035a4dea01f581230c50809f372e

FROM ghcr.io/pnpm/pnpm:12.5.1@sha256:0a4219f2ae582bce0e52073876c20e6387147f0809d8546744d87243797633ed AS pnpm

FROM mcr.microsoft.com/devcontainers/base:trixie@sha256:1f851004adcd3dff3776b4a1da86727cf52280b0fdc9d5b0568c9c7d74274286
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
