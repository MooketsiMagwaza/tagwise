# The Tagwise web app as a static build behind a plain nginx. The gateway
# (docker/nginx) proxies to this container's port 80 like any other service.
# Built from the repository root: docker build -f docker/web/Dockerfile .
FROM node:22-slim AS builder
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Empty: the app uses its in-browser sample data (LocalRepository).
# Set it (for example /api) to use HttpRepository against the services.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.31-alpine AS runtime
COPY --from=builder /build/dist /usr/share/nginx/html
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
