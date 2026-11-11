# RUWATA site — Node server + Postgres, for Coolify.
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
# Build for a plain Node server instead of Cloudflare Workers.
ENV NITRO_PRESET=node-server
RUN bun run build

FROM oven/bun:1 AS run
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/.output ./.output
COPY db ./db
COPY src/assets ./src/assets
EXPOSE 3000
# Create tables + seed the catalogue (safe to re-run), then start the site.
CMD ["sh", "-c", "bun db/seed.ts && bun .output/server/index.mjs"]
