#!/bin/sh
set -eu
if [ -z "${NIUBIGEO_PASSWORD:-}" ]; then
  echo "NIUBIGEO_PASSWORD is not set; refusing to expose the workbench without a password." >&2
  exit 1
fi
export NIUBIGEO_PASSWORD_HASH="$(caddy hash-password --plaintext "$NIUBIGEO_PASSWORD")"
mkdir -p "$PRODUCT_DATA_DIR" "$MONITORING_DATA_DIR"

# Upstream web server, loopback only: nothing reaches it except through Caddy.
HOST=127.0.0.1 PORT="$APP_PORT" node dist/src/product/product-server.js &
APP_PID=$!

WORKER_PID=""
case "$(echo "$NIUBIGEO_WORKER_ENABLED" | tr 'A-Z' 'a-z')" in
  1|true|yes|on)
    ( while true; do
        node dist/src/product/scheduling/schedule-worker.js "$NIUBIGEO_WORKER_INTERVAL" || true
        echo "schedule worker exited; restarting in 10s" >&2
        sleep 10
      done ) &
    WORKER_PID=$!
    ;;
esac

caddy run --config /etc/niubigeo-railway/Caddyfile --adapter caddyfile &
CADDY_PID=$!

trap 'kill $APP_PID $CADDY_PID $WORKER_PID 2>/dev/null; exit 0' TERM INT
# Exit (and let Railway restart us) if the web server or proxy dies.
while kill -0 "$APP_PID" 2>/dev/null && kill -0 "$CADDY_PID" 2>/dev/null; do sleep 5; done
echo "web server or proxy exited" >&2
kill $APP_PID $CADDY_PID $WORKER_PID 2>/dev/null || true
exit 1
