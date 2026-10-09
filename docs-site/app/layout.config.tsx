import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { surfaces } from '@/lib/surfaces';

/**
 * Shared layout options (nav title, links) used by both the home and docs
 * layouts.
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="font-semibold tracking-tight">
        Tagwise <span className="font-normal text-fd-muted-foreground">Docs</span>
      </span>
    ),
  },
  links: [
    {
      text: 'Documentation',
      url: '/docs',
      active: 'nested-url',
    },
    {
      text: 'API',
      url: '/docs/reference',
      active: 'nested-url',
    },
    {
      text: 'App',
      url: surfaces.app,
      external: true,
    },
    {
      text: 'Grafana',
      url: surfaces.grafana,
      external: true,
    },
  ],
  githubUrl: surfaces.github,
};
