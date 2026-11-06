# syntax=docker/dockerfile:1
# Fuel the Ride: one container that runs the API and serves the built React app.

# ---- Stage 1: build the web app ----
FROM node:24-alpine AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/fuel-core/package.json packages/fuel-core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace=@fuel-ride/web
COPY packages/fuel-core/src packages/fuel-core/src
COPY apps/web apps/web
RUN npm run build --workspace=@fuel-ride/web

# ---- Stage 2: runtime (API + built web app) ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies for the API workspace only (cached unless package files change)
COPY package.json package-lock.json ./
COPY packages/fuel-core/package.json packages/fuel-core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace=@fuel-ride/api && npm cache clean --force

# App source + the built web app (served by Express from apps/web/dist)
COPY packages/fuel-core/src packages/fuel-core/src
COPY apps/api/src apps/api/src
COPY --from=web-build /app/apps/web/dist apps/web/dist

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "apps/api/src/server.js"]
