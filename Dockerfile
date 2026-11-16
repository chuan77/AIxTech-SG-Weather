# Lepak Weather: one container running the Express server, which also serves the built frontend.
# Built remotely by Vercel's Container preset (see docs/deployment.md).

# --- build: install everything for the frontend and backend workspaces and compile both ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY docs/package.json docs/
RUN npm ci --workspace frontend --workspace backend --include-workspace-root --ignore-scripts
COPY frontend frontend
COPY backend backend
# Vite bakes VITE_* values into the frontend bundle at build time. Vercel passes the project's
# environment variables to the image build as build arguments, so declare the one the map needs.
# It is public by design (CARTO keys are client-side); restrict it to the site's domain at CARTO.
ARG VITE_CARTO_API_KEY
RUN npm run build

# --- runtime: production dependencies, compiled server, migrations and built frontend only ---
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_REQUIRE_REMOTE=true \
    LOG_FILE_PATH=/tmp/lepak-weather.log
# The app runs as the non-root node user, which cannot create backend/logs under the root-owned
# /app, so the second log copy goes to /tmp. Vercel collects the stdout copy.
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY docs/package.json docs/
RUN npm ci --omit=dev --workspace frontend --workspace backend --include-workspace-root --ignore-scripts \
    && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/drizzle backend/drizzle
COPY --from=build /app/frontend/dist frontend/dist
USER node
EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "backend/dist/server.js"]
