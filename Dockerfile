# syntax=docker/dockerfile:1.27.0@sha256:bde3983e9c939224420ddaf6b784cc30e09b035a4dea01f581230c50809f372e

FROM ghcr.io/pnpm/pnpm:12.0.0@sha256:bce5ae25ef95edd79e696d7fa8489b80561ef660100fd35bd0286d0f90db3dcc AS pnpm

FROM node:26.8.1-trixie-slim@sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146 AS frontend
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
WORKDIR /source/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
COPY internal/graphql/schema/ /source/internal/graphql/schema/
RUN pnpm run generate:graphql && pnpm run build

FROM golang:1.27.0-trixie@sha256:ae28539d2ef595b9a2930dd7f031d9592376829dc0eae7cb869559f7d5812c3a AS backend
WORKDIR /source
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
COPY --from=frontend /source/internal/web/assets/dist/ /source/internal/web/assets/dist/
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" go build -trimpath -ldflags="-s -w" -o /out/vikunja-better-ui ./cmd/server

FROM gcr.io/distroless/static-debian13:nonroot@sha256:1c2c046bc09ed40fad370b599a0b1ae7987f55b01e247cf27a7c27cd97e5bbc7
COPY --from=backend --chown=nonroot:nonroot /out/vikunja-better-ui /vikunja-better-ui
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/vikunja-better-ui"]
