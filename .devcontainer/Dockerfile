# syntax=docker/dockerfile:1.27.0@sha256:bde3983e9c939224420ddaf6b784cc30e09b035a4dea01f581230c50809f372e

FROM ghcr.io/pnpm/pnpm:12.0.0@sha256:bce5ae25ef95edd79e696d7fa8489b80561ef660100fd35bd0286d0f90db3dcc AS pnpm

FROM mcr.microsoft.com/devcontainers/base:trixie@sha256:b8c3669fb4cc652621b3386517c40ab3e151e827de958d6fe75528798ffb5727
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
