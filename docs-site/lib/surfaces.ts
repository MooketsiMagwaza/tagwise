/**
 * The other places Tagwise lives, so the docs can point at them. Each address
 * is set when the site is built (`NEXT_PUBLIC_*`); the defaults are the local
 * development stack's (docker/compose.dev.yml and docker/observability).
 *
 *   app      the web app, behind the gateway
 *   grafana  dashboards (needs the observability stack running)
 */
const app = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5290').replace(/\/$/, '');

export const surfaces = {
  app,
  grafana: (process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3029').replace(/\/$/, ''),
  github: 'https://github.com/MooketsiMagwaza/tagwise',
} as const;
