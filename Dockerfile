# NiubiGEO on Railway: the official upstream image (Albert-Weasker/niubigeo
# v0.3.3, Apache-2.0) plus what Railway needs around it, in ONE container:
#   - Caddy on Railway's $PORT plus a tiny cookie login gate (the workbench
#     has no built-in authentication; upstream says remote deployments need
#     auth at the proxy). Basic auth is not used because the app itself uses
#     the Authorization header for provider keys. Only /health is open.
#   - the optional schedule worker (compose profile "monitoring") runs next to
#     the web server, because Railway volumes cannot be shared across services.
FROM caddy:2.10.2-alpine AS edge

FROM ghcr.io/albert-weasker/niubigeo:v0.3.3@sha256:5950b779edc0de9c3e869cdbbb6166a8053e0e7c209f7d00a8ca680d43c5841f
RUN apk add --no-cache tini
COPY --from=edge /usr/bin/caddy /usr/local/bin/caddy
COPY railway/Caddyfile /etc/niubigeo-railway/Caddyfile
COPY railway/gate.mjs /etc/niubigeo-railway/gate.mjs
COPY railway/start.sh /usr/local/bin/niubigeo-railway-start
RUN chmod 755 /usr/local/bin/niubigeo-railway-start \
 && node --check /etc/niubigeo-railway/gate.mjs \
 && caddy validate --config /etc/niubigeo-railway/Caddyfile --adapter caddyfile
# Plain defaults live in the image so the Railway template only needs a
# generated password. Override any of them with a Railway variable.
ENV PORT=8080 \
    APP_PORT=8787 \
    PRODUCT_DATA_DIR=/app/data/product-v2 \
    MONITORING_DATA_DIR=/app/data \
    GATE_PORT=8789 \
    NIUBIGEO_USERNAME=admin \
    NIUBIGEO_WORKER_ENABLED=true \
    NIUBIGEO_WORKER_INTERVAL=60 \
    NIUBIGEO_VIDEO_ADVISOR_ENABLED=true
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "-g", "--", "/usr/local/bin/niubigeo-railway-start"]
