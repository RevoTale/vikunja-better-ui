# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM ghcr.io/pnpm/pnpm:11.24.0@sha256:f18a4dfbfd23931624a2396829ca921c7c262bf63fd4fa55af07654a7d41834e AS pnpm

FROM node:26.7.0-trixie-slim@sha256:5758d367d7b4f48b73a9bb3530e687e47efb289f3b43f9c0450a25225ae0db5d AS frontend
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
COPY --from=frontend /source/internal/web/assets/ /source/internal/web/assets/
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" go build -trimpath -ldflags="-s -w" -o /out/vikunja-better-ui ./cmd/server

FROM gcr.io/distroless/static-debian13:nonroot@sha256:1c2c046bc09ed40fad370b599a0b1ae7987f55b01e247cf27a7c27cd97e5bbc7
COPY --from=backend --chown=nonroot:nonroot /out/vikunja-better-ui /vikunja-better-ui
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/vikunja-better-ui"]
