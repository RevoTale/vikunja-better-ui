# syntax=docker/dockerfile:1.26.0@sha256:ecfaec9ed6d810b56388c508f4121597bfbba70d41a6dfeee4d8cad5f295fc32

FROM node:26.7.0-trixie-slim@sha256:4ebb5ace66f15a24c14c492e01a8beeed4fddf970a856109f5126e703e5fe503 AS frontend
WORKDIR /source/frontend
RUN npm install --global pnpm@11.22.0
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
COPY internal/graphql/schema/ /source/internal/graphql/schema/
RUN pnpm run generate:graphql && pnpm run build

FROM golang:1.27.0-trixie@sha256:6212da3924947f4b6a939df02ea627c13f338f1a41d6c3fcb0dd9d076eef46c4 AS backend
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
