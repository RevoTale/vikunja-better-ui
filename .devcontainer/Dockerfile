# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM ghcr.io/pnpm/pnpm:11.24.0@sha256:f18a4dfbfd23931624a2396829ca921c7c262bf63fd4fa55af07654a7d41834e AS pnpm

FROM mcr.microsoft.com/devcontainers/base:trixie@sha256:b8c3669fb4cc652621b3386517c40ab3e151e827de958d6fe75528798ffb5727
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
