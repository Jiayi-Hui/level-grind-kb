#!/usr/bin/env sh
set -eu

BASE_URL="${1:-https://cn.level-grind.com}"
MIRROR_IP="${MIRROR_IP:-}"
HOST_NAME="${BASE_URL#*://}"
HOST_NAME="${HOST_NAME%%/*}"

curl_args="-fsS"
if [ -n "$MIRROR_IP" ]; then
  curl_args="$curl_args --resolve ${HOST_NAME}:443:${MIRROR_IP}"
fi

request() {
  # shellcheck disable=SC2086
  curl $curl_args "$@"
}

echo "Checking local mirror health..."
request "$BASE_URL/mirror-health" | grep -q "level-grind-hk-mirror: ok"

echo "Checking workspace HTML..."
home_file="$(mktemp)"
trap 'rm -f "$home_file"' EXIT
request "$BASE_URL/" > "$home_file"
grep -q "Level Grind Research OS" "$home_file"

echo "Checking sign-in route..."
request "$BASE_URL/sign-in" > /dev/null

echo "Checking a client asset..."
asset_path="$(grep -Eo '/assets/[A-Za-z0-9_.-]+\.js' "$home_file" | head -n 1)"
test -n "$asset_path"
request "$BASE_URL$asset_path" > /dev/null

echo "Checking protected API behavior..."
# shellcheck disable=SC2086
api_status="$(curl $curl_args -o /dev/null -w '%{http_code}' "$BASE_URL/api/models")"
test "$api_status" = "401"

echo "Mirror smoke test passed."
