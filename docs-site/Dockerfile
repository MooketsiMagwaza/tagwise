FROM node:24-alpine AS dependencies

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /workspace/docs-site
COPY docs-site/package.json docs-site/pnpm-lock.yaml docs-site/pnpm-workspace.yaml ./
# The package's postinstall (`fumadocs-mdx`) needs source.config.ts and the
# synced content, which do not exist in this manifest-only layer. It runs in
# the build stage instead, after the sources and Markdown are copied.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS build
ENV NEXT_STANDALONE=true
# Where the app and Grafana live (baked in at build: NEXT_PUBLIC_*).
ARG NEXT_PUBLIC_APP_URL=http://localhost:5290
ARG NEXT_PUBLIC_GRAFANA_URL=http://localhost:3029
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_GRAFANA_URL=$NEXT_PUBLIC_GRAFANA_URL
WORKDIR /workspace
COPY docs-site ./docs-site
# The published Markdown (see docs-site/scripts/manifest.mjs), the app's
# theme tokens and its screenshots.
COPY README.md ARCHITECTURE.md PROVENANCE.md ./
COPY docs ./docs
COPY src/theme/tokens.css ./src/theme/tokens.css
COPY public/screens ./public/screens
WORKDIR /workspace/docs-site
# Sync the Markdown, generate the Fumadocs index from it, then build.
RUN node scripts/sync-content.mjs \
    && pnpm exec fumadocs-mdx \
    && pnpm exec next build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3010

WORKDIR /app
RUN addgroup --system --gid 1001 tagwise && \
    adduser --system --uid 1001 --ingroup tagwise tagwise
COPY --from=build --chown=tagwise:tagwise /workspace/docs-site/.next/standalone ./
COPY --from=build --chown=tagwise:tagwise /workspace/docs-site/.next/static ./.next/static
USER tagwise
EXPOSE 3010
CMD ["node", "server.js"]
