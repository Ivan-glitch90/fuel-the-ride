# syntax=docker/dockerfile:1
# Fuel the Ride: one container that runs the API (and, once apps/web exists, serves the built React app).

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies for the API workspace only (cached unless package files change)
COPY package.json package-lock.json ./
COPY packages/fuel-core/package.json packages/fuel-core/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace=@fuel-ride/api && npm cache clean --force

# App source
COPY packages/fuel-core/src packages/fuel-core/src
COPY apps/api/src apps/api/src
# TODO (web app step): add a build stage for apps/web and copy its dist/ to apps/web/dist

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["node", "apps/api/src/server.js"]
