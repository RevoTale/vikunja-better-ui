# syntax=docker/dockerfile:1.27.1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e

FROM ghcr.io/pnpm/pnpm:12.5.1@sha256:0a4219f2ae582bce0e52073876c20e6387147f0809d8546744d87243797633ed AS pnpm

FROM node:26.10.0-trixie-slim@sha256:ec7758ee051e457b468b32bde57b0879010b325bb9862718e9615225ce4aaae1 AS frontend
COPY --from=pnpm /opt/pnpm /opt/pnpm
ENV PATH=/opt/pnpm:$PATH
WORKDIR /source/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
COPY internal/graphql/schema/ /source/internal/graphql/schema/
RUN pnpm run generate:graphql && pnpm run build

FROM golang:1.27.1-trixie@sha256:433790e515d27dc6003e847e644cc0af956985cf315c1c58a3b73ee2dd305183 AS backend
WORKDIR /source
COPY go.mod go.sum ./
RUN go mod download
COPY . ./
COPY --from=frontend /source/internal/web/assets/dist/ /source/internal/web/assets/dist/
ARG TARGETOS
ARG TARGETARCH
RUN CGO_ENABLED=0 GOOS="$TARGETOS" GOARCH="$TARGETARCH" go build -trimpath -ldflags="-s -w" -o /out/vikunja-better-ui ./cmd/server

FROM gcr.io/distroless/static-debian13:nonroot@sha256:e2e927ec666bae08560abb3c55d0659eceabb657f56b6782ab500a9fc7f555e3
COPY --from=backend --chown=nonroot:nonroot /out/vikunja-better-ui /vikunja-better-ui
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/vikunja-better-ui"]
