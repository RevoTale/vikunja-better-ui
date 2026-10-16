#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
image="vikunja-better-ui:smoke"
container="vikunja-better-ui-smoke-$$"
upstream="$container-upstream"
network="$container-network"
fixture_dir="$(mktemp -d)"

cleanup() {
  local status=$?
  if [[ "$status" != 0 ]]; then
    docker logs "$container" >&2 2>/dev/null || true
    docker logs "$upstream" >&2 2>/dev/null || true
  fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker rm -f "$upstream" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
  rm -f "$fixture_dir/key.pem" "$fixture_dir/cert.pem"
  rmdir "$fixture_dir"
}
trap cleanup EXIT INT TERM

docker build --tag "$image" "$repo_root"
node_image="$(awk '/^FROM .* AS frontend$/ {for (i=2;i<=NF;i++) if ($i ~ /^node:/) print $i}' "$repo_root/Dockerfile")"
test -n "$node_image"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout "$fixture_dir/key.pem" -out "$fixture_dir/cert.pem" \
  -subj "/CN=$upstream" -addext "subjectAltName=DNS:$upstream" >/dev/null 2>&1
docker network create "$network" >/dev/null
docker create --name "$upstream" --network "$network" "$node_image" node -e '
  const fs = require("node:fs");
  require("node:https").createServer({key:fs.readFileSync("/tmp/key.pem"),cert:fs.readFileSync("/tmp/cert.pem")}, (req,res) => {
    res.writeHead(req.url === "/api/v2/info" ? 200 : 404, {"Content-Type":"application/json"});
    res.end(JSON.stringify({version:"v2.7.0"}));
  }).listen(3456,"0.0.0.0");' >/dev/null
docker cp "$fixture_dir/key.pem" "$upstream:/tmp/key.pem"
docker cp "$fixture_dir/cert.pem" "$upstream:/tmp/cert.pem"
docker start "$upstream" >/dev/null
upstream_ready=false
for _ in $(seq 1 60); do
  if docker exec --env NODE_EXTRA_CA_CERTS=/tmp/cert.pem "$upstream" node -e '
    fetch("https://"+process.argv[1]+":3456/api/v2/info").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));' "$upstream"
  then
    upstream_ready=true
    break
  fi
  sleep 0.25
done
if [[ "$upstream_ready" != true ]]; then docker logs "$upstream" >&2; exit 1; fi
docker create --name "$container" --network "$network" \
  --publish "${SMOKE_PUBLISH_HOST:-127.0.0.1}::8080" \
  --env APP_ENV=production \
  --env "APP_VIKUNJA_URL=https://$upstream:3456" \
  --env SSL_CERT_FILE=/tmp/smoke-ca.pem \
  --env APP_VIKUNJA_API_TOKEN=smoke-token \
  --env APP_AUTH_USERNAME=smoke-user \
  --env APP_AUTH_PASSWORD=smoke-password \
  --env APP_SESSION_SECRET=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY= \
  --env APP_HTTP_ADDR=:8080 \
  --env APP_ALLOWED_ORIGIN=https://tasks.example.invalid \
  "$image" >/dev/null
docker cp "$fixture_dir/cert.pem" "$container:/tmp/smoke-ca.pem"
docker start "$container" >/dev/null

port="$(docker port "$container" 8080/tcp | awk -F: 'NR == 1 {print $NF}')"
probe_host="${SMOKE_PROBE_HOST:-127.0.0.1}"
if [[ -z "${SMOKE_PROBE_HOST:-}" ]] && getent hosts host.docker.internal >/dev/null 2>&1; then
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
