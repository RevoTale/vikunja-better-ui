# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM ghcr.io/pnpm/pnpm:11.22.0@sha256:eba76954b37ec1ba6187f0adb39caee1e31733194857eedd01319da0af3fa00d AS pnpm

FROM mcr.microsoft.com/devcontainers/base:trixie@sha256:025b74bb5f7ac53edd77e01aa7188c359aab100e23a2f6220bde50bbb9fd31dd
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
