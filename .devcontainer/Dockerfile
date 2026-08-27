# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM ghcr.io/pnpm/pnpm:12.0.0@sha256:bce5ae25ef95edd79e696d7fa8489b80561ef660100fd35bd0286d0f90db3dcc AS pnpm

FROM mcr.microsoft.com/devcontainers/base:trixie@sha256:025b74bb5f7ac53edd77e01aa7188c359aab100e23a2f6220bde50bbb9fd31dd
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
