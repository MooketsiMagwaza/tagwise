/**
 * What the documentation site publishes, and where. `sync-content.mjs` walks
 * this list, not the repository: nothing is published unless it is named here.
 *
 * Not published: docs/WORK_ORDERS.md (the work-order register) and CLAUDE.md.
 * They are working records, not product documentation.
 */

/** Where links to unpublished repository files point. */
export const GITHUB_BLOB = 'https://github.com/MooketsiMagwaza/tagwise/blob/main';

/** The root `/docs` page. */
export const ROOT_INDEX = { src: 'README.md', title: 'Start here' };

export const SECTIONS = [
  {
    slug: 'architecture',
    title: 'Architecture',
    pages: [
      { src: 'ARCHITECTURE.md', slug: 'index', title: 'Architecture' },
      { src: 'docs/BACKEND.md', slug: 'backend', title: 'Backend' },
      { src: 'PROVENANCE.md', slug: 'provenance', title: 'Where the code came from' },
    ],
  },
  {
    slug: 'operations',
    title: 'Operations',
    pages: [
      { src: 'docs/DEPLOY.md', slug: 'index', title: 'Deploying the web app' },
      { src: 'docs/OBSERVABILITY.md', slug: 'observability', title: 'Observability' },
    ],
  },
  {
    slug: 'design-system',
    title: 'Design system',
    pages: [{ src: 'docs/DESIGN.md', slug: 'index', title: 'Design system' }],
  },
];
