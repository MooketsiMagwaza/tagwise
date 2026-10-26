// The "Under the hood" diagram on the public page, drawn as inline SVG so it
// is sharp at any size and follows the page's light and dark palette. Two
// layouts: a wide one, and a tall one for phones (CSS shows one of them).
// Every box is something in the repository: backend/Cargo.toml (the five
// services), docker/compose.dev.yml (gateway, PostgreSQL, Redis, docs, web)
// and docker/observability (collector, Tempo, Prometheus, Grafana).

import styles from './ArchitectureDiagram.module.css';

type Kind = 'app' | 'gateway' | 'service' | 'store' | 'docs' | 'plain';

function Box({ x, y, w, h, title, sub, kind = 'service' }: { x: number; y: number; w: number; h: number; title: string; sub?: string[]; kind?: Kind }) {
  const lines = sub ?? [];
  const block = 18 + lines.length * 16;
  const top = y + (h - block) / 2 + 14;
  return (
    <g className={styles[kind]}>
      <rect x={x} y={y} width={w} height={h} rx={6} />
      <text x={x + w / 2} y={top} className={styles.title}>
        {title}
      </text>
      {lines.map((line, i) => (
        <text key={line} x={x + w / 2} y={top + 18 + i * 16} className={styles.sub}>
          {line}
        </text>
      ))}
    </g>
  );
}

function Chip({ x, y, w, label }: { x: number; y: number; w: number; label: string }) {
  return (
    <g className={styles.chip}>
      <rect x={x} y={y} width={w} height={28} rx={4} />
      <text x={x + w / 2} y={y + 19}>
        {label}
      </text>
    </g>
  );
}

function Arrow({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className={styles.head} />
      </marker>
    </defs>
  );
}

const SERVICES = ['identity', 'register', 'notifications', 'media', 'ops'];

function Wide() {
  const a = 'url(#tw-arrow-wide)';
  return (
    <svg viewBox="0 0 1000 560" className={styles.wide} role="img" aria-labelledby="arch-wide-title arch-wide-desc">
      <title id="arch-wide-title">How Tagwise is put together</title>
      <desc id="arch-wide-desc">
        The web app keeps its sample workspace in browser storage and does not call the services yet. Behind an nginx gateway sit five Rust services
        (identity, register, notifications, media, ops) and the docs site. The services use PostgreSQL, one database each, and a shared Redis. They send
        traces to an OpenTelemetry collector and Tempo; Prometheus reads their metrics; Grafana shows both.
      </desc>
      <Arrow id="tw-arrow-wide" />

      <Box x={180} y={16} w={340} h={72} kind="app" title="Web app" sub={['React 18 · TypeScript · Vite']} />
      <Box x={550} y={16} w={130} h={72} kind="store" title="Browser storage" sub={['sample workspace']} />
      <path d="M520 52 H548" className={styles.edge} markerEnd={a} />

      <path d="M350 88 V148" className={styles.dashed} markerEnd={a} />
      <text x={362} y={124} className={styles.note}>
        not called yet
      </text>

      <Box x={20} y={150} w={660} h={60} kind="gateway" title="nginx gateway" sub={['one entry point: /api/v1/* to the services, /docs to the docs site']} />
      <Box x={720} y={150} w={260} h={60} kind="docs" title="Docs site" sub={['Fumadocs on Next.js']} />
      <path d="M680 180 H718" className={styles.edge} markerEnd={a} />

      {SERVICES.map((name, i) => {
        const x = 20 + i * 135;
        return (
          <g key={name}>
            <path d={`M${x + 60} 210 V264`} className={styles.edge} markerEnd={a} />
            <Box x={x} y={266} w={120} h={72} title={name} sub={['Rust · axum']} />
            <path d={`M${x + 60} 338 V380`} className={styles.edge} />
          </g>
        );
      })}
      <path d="M80 380 H620" className={styles.edge} />
      <path d="M230 380 V418" className={styles.edge} markerEnd={a} />
      <path d="M575 380 V418" className={styles.edge} markerEnd={a} />
      <Box x={20} y={420} w={420} h={72} kind="store" title="PostgreSQL 15" sub={['a database per service, each with its own migrations']} />
      <Box x={470} y={420} w={210} h={72} kind="store" title="Redis 7" sub={['sign-out list, rate limits']} />

      <path d="M680 302 H718" className={styles.edge} markerEnd={a} />
      <g className={styles.group}>
        <rect x={720} y={250} width={260} height={290} rx={8} />
        <text x={736} y={276} className={styles.groupTitle}>
          Observability
        </text>
      </g>
      <Box x={736} y={290} w={110} h={56} title="OpenTelemetry" sub={['collector']} />
      <Box x={858} y={290} w={106} h={56} title="Prometheus" sub={['reads /metrics']} />
      <Box x={736} y={384} w={110} h={56} title="Tempo" sub={['traces']} />
      <Box x={736} y={468} w={228} h={56} title="Grafana" sub={['dashboards for metrics and traces']} />
      <path d="M791 346 V382" className={styles.edge} markerEnd={a} />
      <path d="M791 440 V466" className={styles.edge} markerEnd={a} />
      <path d="M911 346 V466" className={styles.edge} markerEnd={a} />
    </svg>
  );
}

function Tall() {
  const a = 'url(#tw-arrow-tall)';
  return (
    <svg viewBox="0 0 360 742" className={styles.tall} role="img" aria-labelledby="arch-tall-title arch-tall-desc">
      <title id="arch-tall-title">How Tagwise is put together</title>
      <desc id="arch-tall-desc">
        The web app keeps its sample workspace in browser storage and does not call the services yet. Behind an nginx gateway sit five Rust services and the
        docs site. The services use PostgreSQL, one database each, and Redis, and report to an observability stack of an OpenTelemetry collector, Tempo,
        Prometheus and Grafana.
      </desc>
      <Arrow id="tw-arrow-tall" />

      <Box x={20} y={16} w={190} h={64} kind="app" title="Web app" sub={['React · TypeScript']} />
      <Box x={226} y={16} w={114} h={64} kind="store" title="Browser" sub={['sample workspace']} />
      <path d="M210 48 H224" className={styles.edge} markerEnd={a} />

      <path d="M115 80 V126" className={styles.dashed} markerEnd={a} />
      <text x={125} y={108} className={styles.note}>
        not called yet
      </text>
      <Box x={20} y={128} w={320} h={56} kind="gateway" title="nginx gateway" sub={['/api/v1/* and /docs']} />

      <path d="M130 184 V218" className={styles.edge} markerEnd={a} />
      <path d="M300 184 V218" className={styles.edge} markerEnd={a} />
      <g className={styles.group}>
        <rect x={20} y={220} width={240} height={226} rx={8} />
        <text x={36} y={244} className={styles.groupTitle}>
          Rust services
        </text>
        <text x={36} y={262} className={styles.groupSub}>
          axum · sqlx · OpenAPI
        </text>
      </g>
      {SERVICES.map((name, i) => (
        <Chip key={name} x={36} y={276 + i * 33} w={208} label={name} />
      ))}
      <Box x={272} y={220} w={68} h={72} kind="docs" title="Docs" sub={['Fumadocs']} />

      <path d="M110 446 V478" className={styles.edge} markerEnd={a} />
      <path d="M230 446 V462 H282 V478" className={styles.edge} markerEnd={a} />
      <Box x={20} y={480} w={190} h={72} kind="store" title="PostgreSQL" sub={['a database', 'per service']} />
      <Box x={226} y={480} w={114} h={72} kind="store" title="Redis" sub={['sign-outs,', 'rate limits']} />

      <path d="M260 333 H350 V600 H342" className={styles.edge} markerEnd={a} />
      <g className={styles.group}>
        <rect x={20} y={584} width={320} height={142} rx={8} />
        <text x={36} y={608} className={styles.groupTitle}>
          Observability
        </text>
        <text x={36} y={626} className={styles.groupSub}>
          traces and /metrics from every service
        </text>
      </g>
      <Chip x={36} y={640} w={140} label="OpenTelemetry" />
      <Chip x={184} y={640} w={140} label="Tempo" />
      <Chip x={36} y={678} w={140} label="Prometheus" />
      <Chip x={184} y={678} w={140} label="Grafana" />
    </svg>
  );
}

export function ArchitectureDiagram() {
  return (
    <div className={styles.frame}>
      <Wide />
      <Tall />
      <p className={styles.legend}>
        <span className={styles.keySolid} aria-hidden="true" /> in place in the code and the Compose files
        <span className={styles.keyDashed} aria-hidden="true" /> the app does not call the services yet
      </p>
    </div>
  );
}
