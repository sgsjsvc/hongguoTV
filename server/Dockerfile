FROM node:22.20.0-bookworm-slim AS web-build
WORKDIR /app
COPY apps/web-pc/package*.json ./apps/web-pc/
RUN npm --prefix apps/web-pc ci --no-audit --no-fund
COPY apps/web-pc/ ./apps/web-pc/
COPY shared/ ./shared/
RUN npm --prefix apps/web-pc run build

FROM node:22.20.0-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY LICENSE ./LICENSE
COPY server/ ./server/
COPY shared/ ./shared/
COPY --from=web-build /app/apps/web-pc/dist ./apps/web-pc/dist
RUN mkdir /data && chown node:node /data
ENV HG_HOST=0.0.0.0 PORT=8788 HG_DATA_DIR=/data
EXPOSE 8788
VOLUME /data
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "server/healthcheck.mjs"]
CMD ["node", "server/index.mjs"]
