#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image="vikunja-better-ui:smoke"
container="vikunja-better-ui-smoke-$$"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build --tag "$image" "$repo_root"
docker run --detach --name "$container" --publish 127.0.0.1::8080 \
  --env APP_ENV=production \
  --env APP_VIKUNJA_URL=https://vikunja.example.invalid \
  --env APP_VIKUNJA_API_TOKEN=smoke-token \
  --env APP_AUTH_USERNAME=smoke-user \
  --env APP_AUTH_PASSWORD=smoke-password \
  --env APP_SESSION_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY= \
  --env APP_HTTP_ADDR=:8080 \
  --env APP_ALLOWED_ORIGIN=https://tasks.example.invalid \
  "$image" >/dev/null

port="$(docker port "$container" 8080/tcp | awk -F: 'NR == 1 {print $NF}')"
probe_host="127.0.0.1"
if getent hosts host.docker.internal >/dev/null 2>&1; then
  probe_host="host.docker.internal"
fi
for _ in $(seq 1 60); do
  if curl --noproxy '*' -fsS "http://$probe_host:$port/healthz" | grep -qx ok; then
    curl --noproxy '*' -fsS "http://$probe_host:$port/" | grep -q '<div id="root"></div>'
    test "$(docker inspect --format '{{.Config.User}}' "$container")" = "nonroot:nonroot"
    exit 0
  fi
  sleep 0.25
done

docker logs "$container" >&2
exit 1
