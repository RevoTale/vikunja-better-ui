#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
metadata_file="$repo_root/tests/e2e/harness/vikunja-2.5.0.json"
cache_dir="$repo_root/.cache/e2e/vikunja-2.5.0"
run_dir="$(mktemp -d "${TMPDIR:-/tmp}/vikunja-better-ui-e2e.XXXXXX")"
vikunja_pid=""
app_pid=""

cleanup() {
  local status=$?
  if [[ -n "$app_pid" ]]; then kill "$app_pid" 2>/dev/null || true; wait "$app_pid" 2>/dev/null || true; fi
  if [[ -n "$vikunja_pid" ]]; then kill "$vikunja_pid" 2>/dev/null || true; wait "$vikunja_pid" 2>/dev/null || true; fi
  if [[ $status -ne 0 ]]; then
    echo "Vikunja log:" >&2
    tail -80 "$run_dir/vikunja.log" 2>/dev/null >&2 || true
    echo "Application log:" >&2
    tail -80 "$run_dir/app.log" 2>/dev/null >&2 || true
  fi
  rm -rf -- "$run_dir"
  exit "$status"
}
trap cleanup EXIT INT TERM

wait_ready() {
  local url=$1
  for _ in $(seq 1 120); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  echo "Timed out waiting for $url" >&2
  return 1
}

case "$(uname -m)" in
  x86_64) architecture="amd64" ;;
  aarch64|arm64) architecture="arm64" ;;
  *) echo "Unsupported E2E architecture: $(uname -m)" >&2; exit 1 ;;
esac

read_metadata() {
  node -e 'const m=require(process.argv[1]); console.log(m.architectures[process.argv[2]][process.argv[3]])' "$metadata_file" "$architecture" "$1"
}

archive="$cache_dir/vikunja.zip"
signature="$cache_dir/vikunja.zip.sig"
mkdir -p "$cache_dir"
[[ -f "$archive" ]] || curl -fsSL --retry 3 -o "$archive" "$(read_metadata url)"
[[ -f "$signature" ]] || curl -fsSL --retry 3 -o "$signature" "$(read_metadata signatureUrl)"
echo "$(read_metadata archiveSha256)  $archive" | sha256sum --check --status

mkdir -m 700 "$run_dir/gnupg"
GNUPGHOME="$run_dir/gnupg" gpg --batch --quiet --import "$repo_root/tests/e2e/harness/vikunja-release-key.asc"
fingerprint="$(GNUPGHOME="$run_dir/gnupg" gpg --batch --with-colons --fingerprint | awk -F: '$1 == "fpr" {print $10; exit}')"
[[ "$fingerprint" == "7D061A4AA61436B40713D42EFF054DACD908493A" ]]
GNUPGHOME="$run_dir/gnupg" gpg --batch --quiet --verify "$signature" "$archive"

unzip -q "$archive" -d "$run_dir/vikunja"
binary="$run_dir/vikunja/vikunja-v2.5.0-linux-$architecture"
echo "$(read_metadata binarySha256)  $binary" | sha256sum --check --status
chmod +x "$binary"

free_port() {
  node -e 'const n=require("node:net");const s=n.createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}
vikunja_port="$(free_port)"
app_port="${E2E_APP_PORT:-$(free_port)}"
vikunja_url="http://127.0.0.1:$vikunja_port"
app_host="127.0.0.1"
app_url="http://127.0.0.1:$app_port"
if [[ "${E2E_DEMO:-}" == "1" ]]; then
  app_host="0.0.0.0"
  app_url="${E2E_DEMO_ORIGIN:-http://127.0.0.1:$app_port}"
fi
vikunja_user="e2e-user"
vikunja_password="e2e-password-strong"

export VIKUNJA_DATABASE_TYPE=sqlite
export VIKUNJA_DATABASE_PATH="$run_dir/vikunja.db"
export VIKUNJA_FILES_BASEPATH="$run_dir/files"
export VIKUNJA_SERVICE_INTERFACE="127.0.0.1:$vikunja_port"
export VIKUNJA_SERVICE_PUBLICURL="$vikunja_url"
export VIKUNJA_SERVICE_FRONTENDURL="$vikunja_url"
export VIKUNJA_SERVICE_SECRET="vikunja-e2e-process-secret"
export VIKUNJA_SERVICE_ENABLEREGISTRATION=false
export VIKUNJA_MAILER_ENABLED=false

"$binary" migrate >/dev/null
"$binary" user create --username "$vikunja_user" --email e2e@example.invalid --password "$vikunja_password" >/dev/null
"$binary" web >"$run_dir/vikunja.log" 2>&1 &
vikunja_pid=$!
wait_ready "$vikunja_url/api/v2/info"

fixture_json="$(node "$repo_root/tests/e2e/harness/fixtures.mjs" "$vikunja_url" "$vikunja_user" "$vikunja_password")"
api_token="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d.token)' "$fixture_json")"
export E2E_PROJECT_ID="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d.projectId)' "$fixture_json")"
export E2E_EMPTY_PROJECT_ID="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d.emptyProjectId)' "$fixture_json")"
export E2E_TIMEZONE="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d.timezone)' "$fixture_json")"
export E2E_INVALID_TITLE="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d.invalidTitle)' "$fixture_json")"
export E2E_LABELED_TITLE="$(node -e 'const d=JSON.parse(process.argv[1]);process.stdout.write(d.labeledTitle)' "$fixture_json")"

pnpm --dir "$repo_root/frontend" run generate:graphql >/dev/null
pnpm --dir "$repo_root/frontend" run build >/dev/null
(cd "$repo_root" && go build -a -o "$run_dir/app" ./cmd/server)

export APP_ENV=test
export APP_VIKUNJA_URL="$vikunja_url"
export APP_VIKUNJA_API_TOKEN="$api_token"
export APP_AUTH_USERNAME="app-user"
export APP_AUTH_PASSWORD="app-password-strong"
export APP_SESSION_SECRET="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
export APP_HTTP_ADDR="$app_host:$app_port"
export APP_ALLOWED_ORIGIN="$app_url"
export APP_LOG_LEVEL=warn
export E2E_BASE_URL="$app_url"
export E2E_VIKUNJA_URL="$vikunja_url"
export E2E_VIKUNJA_API_TOKEN="$api_token"

"$run_dir/app" >"$run_dir/app.log" 2>&1 &
app_pid=$!
wait_ready "http://127.0.0.1:$app_port/readyz"
if ! kill -0 "$app_pid" 2>/dev/null; then
  echo "Application exited during startup:" >&2
  cat "$run_dir/app.log" >&2
  exit 1
fi

if [[ "${E2E_DEMO:-}" == "1" ]]; then
  echo "Demo URL: $app_url"
  echo "Username: $APP_AUTH_USERNAME"
  echo "Password: $APP_AUTH_PASSWORD"
  echo "Press Ctrl-C to stop the isolated demo."
  while true; do sleep 30; done
fi

pnpm --dir "$repo_root/frontend" exec playwright test "$@"
