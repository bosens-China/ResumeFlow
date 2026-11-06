FROM node:24.22.2-bookworm-slim AS build

WORKDIR /app
RUN npm install -g pnpm@11.17.0
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build \
    && pnpm --filter @resumeflow/server deploy --prod --legacy /runtime

FROM node:24.22.2-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    RESUMEFLOW_DB_PATH=/data/resumeflow.sqlite \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=build /runtime /app/apps/server
COPY --from=build /app/apps/server/dist /app/apps/server/dist
COPY --from=build /app/apps/web/dist /app/apps/web/dist
RUN /app/apps/server/node_modules/.bin/playwright install --with-deps --only-shell chromium \
    && apt-get update \
    && apt-get install -y --no-install-recommends fonts-noto-cjk \
    && apt-get purge -y --auto-remove xvfb \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir /data \
    && chown node:node /data

USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
