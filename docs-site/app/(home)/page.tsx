import { Pill } from '@/components/pill';
import { ScreenShot } from '@/components/screen';
import { Tile } from '@/components/tile';
import { screenNamed } from '@/lib/screens';
import { surfaces } from '@/lib/surfaces';

const guides = [
  {
    href: '/docs',
    title: 'Start here',
    body: 'What Tagwise is, what works today and what is still a demo, and how to run it.',
  },
  {
    href: '/docs/architecture',
    title: 'Architecture',
    body: 'The web app, the five services behind the gateway, how they talk, and which parts are scaffold that is not wired up yet.',
  },
  {
    href: '/docs/reference',
    title: 'API reference',
    body: 'Every endpoint, generated from the services’ own OpenAPI documents: authentication, errors and one page per resource.',
  },
  {
    href: '/docs/operations',
    title: 'Operations',
    body: 'Deploying the web app, and the metrics, dashboards and traces the services report.',
  },
  {
    href: '/docs/design-system',
    title: 'Design system',
    body: 'The tokens, light and dark palettes, type and components the app is built from.',
  },
];

const around = [
  {
    href: surfaces.app,
    title: 'The app',
    body: 'The register, scanning, labels, imports, stock-takes and the sites map.',
  },
  {
    href: surfaces.grafana,
    title: 'Grafana',
    body: 'Dashboards for the services. Available when the observability stack is running.',
  },
  {
    href: surfaces.github,
    title: 'Source',
    body: 'The repository, with the work-order register that records what was asked and what was done.',
  },
];

export default function HomePage() {
  const dashboard = screenNamed('dashboard');
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-20 px-6 py-20">
      <section className="flex flex-col items-center gap-6 text-center">
        <p className="text-[1.0625rem] font-semibold text-[var(--color-accent-text)]">Documentation</p>
        <h1 className="max-w-3xl text-[clamp(2.5rem,6vw,3.5rem)] font-semibold leading-[1.07] tracking-[-0.02em]">
          How Tagwise is built and run.
        </h1>
        <p className="max-w-2xl text-[1.3125rem] leading-snug text-fd-muted-foreground">
          A shared register for an organisation’s assets and stock: the web app, the services behind it, and the API.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Pill href="/docs">Start here</Pill>
          <Pill href="/docs/reference" variant="link">
            API reference
          </Pill>
        </div>
      </section>

      <ScreenShot shot={dashboard} caption="The dashboard" />

      <section className="flex flex-col gap-6">
        <h2 className="text-[1.75rem] font-semibold tracking-[-0.012em]">The guides</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => (
            <Tile key={guide.href} href={guide.href} title={guide.title}>
              {guide.body}
            </Tile>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-[1.75rem] font-semibold tracking-[-0.012em]">Elsewhere</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {around.map((place) => (
            <Tile key={place.title} href={place.href} title={place.title} external>
              {place.body}
            </Tile>
          ))}
        </div>
      </section>
    </main>
  );
}
