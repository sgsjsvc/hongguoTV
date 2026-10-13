#!/usr/bin/env bash
set -euo pipefail
image="${1:?Pass the image tag to verify}"
container="hongguotv-smoke-$$"
cleanup() {
  local status=$?
  if [[ $status != 0 ]]; then docker logs "$container" || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT
docker run --detach --name "$container" --init --read-only \
  --cap-drop ALL --security-opt no-new-privileges:true \
  --health-interval 1s --health-start-period 1s \
  --tmpfs /data:rw,uid=1000,gid=1000,mode=0700 \
  -p 127.0.0.1::8788 "$image" >/dev/null
healthy=false
for ((i=0; i<40; i++)); do
  if [[ $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]]; then
    healthy=true
    break
  fi
  sleep 1
done
[[ "$healthy" == true ]]
port="$(docker port "$container" 8788/tcp)"
base="http://$port"
curl --fail --silent --show-error "$base/health" |
  node -e 'let s=""; process.stdin.on("data",c=>s+=c).on("end",()=>{const d=JSON.parse(s); if(d.ok!==true)process.exit(1);});'
curl --fail --silent --show-error "$base/" >/dev/null
[[ $(docker exec "$container" id -u) != 0 ]]
echo "Local service startup, non-root runtime, healthcheck, Web page and published port passed."
