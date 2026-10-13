FROM node:22.20.0-bookworm-slim
WORKDIR /app
COPY LICENSE ./LICENSE
COPY shared/library-store.mjs shared/http-json.mjs ./shared/
COPY apps/sync-server/server.mjs apps/sync-server/index.mjs apps/sync-server/admin.mjs apps/sync-server/shared-key.mjs ./apps/sync-server/
COPY apps/sync-server/public ./apps/sync-server/public/
ENV HG_DATA_DIR=/data PORT=8791
EXPOSE 8791
VOLUME /data
CMD ["node","apps/sync-server/index.mjs"]
