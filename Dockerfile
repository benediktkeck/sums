# Self-hosted Sums (server mode): the app only, no website.
# Build: docker build -t sums .   Run: see docker-compose.yml
FROM node:26-bookworm-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
# better-sqlite3 compiles its native module during install.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global pnpm@11.15.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/app/package.json apps/app/
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter "@sums/app..."
COPY packages packages
COPY apps/app apps/app
RUN pnpm --filter @sums/app build

FROM node:26-bookworm-slim AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="Sums" \
      org.opencontainers.image.description="Household budget planner: see what is left each month." \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    SUMS_DB_PATH=/data/sums.db
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/app/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/app/.next/static ./apps/app/.next/static
COPY --from=build --chown=node:node /repo/apps/app/drizzle ./apps/app/drizzle
RUN mkdir -p /data /app/apps/app/.next/cache && chown -R node:node /data /app/apps/app/.next/cache
USER node
# Migrations are read relative to the working directory.
WORKDIR /app/apps/app
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
