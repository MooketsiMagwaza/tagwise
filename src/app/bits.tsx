// Small app-level pieces shared by many screens: the logo, status pills,
// a person chip, a progress bar, the page header and the presence stack.

import type { ReactNode } from 'react';
import { Avatar, Pill, type PillTone, Text } from '../ui';
import { STATUS_LABEL } from '../data/fields';
import type { AssetStatus, Person } from '../data/types';
import type { Peer } from '../data/hooks';
import styles from './bits.module.css';

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={styles.mark}>
      <path
        d="M11 4.5h15a4.5 4.5 0 0 1 4.5 4.5v14a4.5 4.5 0 0 1-4.5 4.5H11a3 3 0 0 1-2.2-.95L2.6 17.9a2.8 2.8 0 0 1 0-3.8l6.2-6.65A3 3 0 0 1 11 4.5Z"
        fill="var(--color-brand)"
      />
      <circle cx="9.6" cy="16" r="2.1" fill="#141a21" />
      <rect x="15" y="10" width="4.5" height="4.5" rx="1" fill="#141a21" />
      <rect x="21.5" y="10" width="4.5" height="4.5" rx="1" fill="#141a21" />
      <rect x="15" y="17.5" width="4.5" height="4.5" rx="1" fill="#141a21" />
      <rect x="21.5" y="17.5" width="2" height="2" rx="0.5" fill="#141a21" />
      <rect x="24" y="20" width="2" height="2" rx="0.5" fill="#141a21" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className={styles.logo}>
      <LogoMark />
      <span className={styles.wordmark}>Tagwise</span>
    </span>
  );
}

export const STATUS_TONE: Record<AssetStatus, PillTone> = {
  in_use: 'accent',
  available: 'success',
  checked_out: 'brand',
  in_repair: 'warning',
  missing: 'danger',
  retired: 'neutral',
};

export function StatusPill({ status, size }: { status: AssetStatus; size?: 'sm' | 'md' }) {
  return (
    <Pill tone={STATUS_TONE[status]} size={size} dot>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

export function PersonChip({ person, detail }: { person: Person | undefined; detail?: ReactNode }) {
  if (!person) return <span className={styles.muted}>Nobody</span>;
  return (
    <span className={styles.person}>
      <Avatar initials={person.initials} hue={person.hue} size="sm" />
      <span className={styles.personText}>
        <span className={styles.personName}>{person.name}</span>
        {detail && <span className={styles.personDetail}>{detail}</span>}
      </span>
    </span>
  );
}

export function Progress({ value, max, label, tone = 'accent' }: { value: number; max: number; label: string; tone?: 'accent' | 'brand' | 'success' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={styles.progress} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={`${styles.bar} ${styles[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** The top of a screen: title, one line of context, and at most two actions. */
export function ScreenHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <Text as="h1" variant="title">
          {title}
        </Text>
        {subtitle && (
          <Text variant="small" tone="secondary">
            {subtitle}
          </Text>
        )}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

/** Avatars of who else is here. Simulated teammates get a dashed ring and
 *  say so in their label, so they are never mistaken for real people. */
export function PresenceStack({ peers, people }: { peers: Peer[]; people: Map<string, Person> }) {
  if (!peers.length) return null;
  const names = peers.map((p) => {
    const person = people.get(p.personId);
    const name = person?.name ?? 'Someone';
    return p.simulated ? `${name} (simulated sample teammate)` : `${name} (you, in another tab)`;
  });
  return (
    <div className={styles.presence} aria-label={`Also here: ${names.join(', ')}`} role="group">
      {peers.slice(0, 4).map((p, i) => {
        const person = people.get(p.personId);
        return (
          <span key={p.key} className={p.simulated ? styles.simulated : styles.real} title={names[i]}>
            <Avatar initials={person?.initials ?? '?'} hue={person?.hue} size="sm" />
          </span>
        );
      })}
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className={styles.kv}>
      {items.map((it) => (
        <div key={it.label} className={styles.kvRow}>
          <dt>{it.label}</dt>
          <dd>{it.value || <span className={styles.muted}>Not set</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
