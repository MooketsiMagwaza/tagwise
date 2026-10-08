import { Avatar } from '../ui';
import { Link } from '../lib/router';
import { relativeTime, shortDate, timeOfDay } from '../lib/format';
import type { Activity, Person } from '../data/types';
import styles from './ActivityLine.module.css';

const VERB: Partial<Record<Activity['kind'], string>> = {
  created: 'added',
  updated: 'edited',
  checked_out: 'checked out',
  returned: 'checked in',
  moved: 'moved',
  commented: 'commented on',
  imported: 'imported',
  count_started: 'started',
  count_closed: 'closed',
  stock_adjusted: 'adjusted',
  labels_printed: 'printed labels for',
  member_changed: 'changed',
  view_saved: 'saved a view',
};

export function hrefFor(a: Activity): string | undefined {
  if (!a.targetId) return undefined;
  if (a.targetType === 'asset') return `/app/assets/${a.targetLabel?.split(' ')[0] ?? a.targetId}`;
  if (a.targetType === 'stock') return `/app/stock/${a.targetId}`;
  if (a.targetType === 'count') return `/app/counts/${a.targetId}`;
  return undefined;
}

/** One line of the activity log: who, did what, to what, when. */
export function ActivityLine({ activity: a, people, compact = false }: { activity: Activity; people: Map<string, Person>; compact?: boolean }) {
  const who = people.get(a.actorId);
  const href = hrefFor(a);
  const target = a.targetLabel && (href ? <Link href={href}>{a.targetLabel}</Link> : <span>{a.targetLabel}</span>);
  const workspaceLevel = !a.targetLabel;
  return (
    <li className={compact ? styles.compact : styles.line}>
      <Avatar initials={who?.initials ?? '?'} hue={who?.hue} size={compact ? 'sm' : 'md'} />
      <div className={styles.body}>
        <p className={styles.what}>
          <strong>{who?.name ?? 'Someone'}</strong> {workspaceLevel ? <span>{a.summary}</span> : <>{VERB[a.kind] ?? 'changed'} {target}</>}
        </p>
        {!workspaceLevel && a.kind !== 'commented' && !a.changes?.length && <p className={styles.detail}>{a.summary}</p>}
        {a.kind === 'commented' && <p className={styles.quote}>{a.summary}</p>}
        {!compact && a.changes && a.changes.length > 0 && (
          <ul className={styles.changes}>
            {a.changes.map((c) => (
              <li key={c.field}>
                {c.field}: <span className={styles.from}>{c.from}</span> → <span className={styles.to}>{c.to}</span>
              </li>
            ))}
          </ul>
        )}
        {compact && a.changes && a.changes.length > 0 && <p className={styles.detail}>{a.changes.map((c) => `${c.field}: ${c.to}`).join(', ')}</p>}
        <time className={styles.time} dateTime={a.at} title={`${shortDate(a.at)} ${timeOfDay(a.at)}`}>
          {relativeTime(a.at)}
        </time>
      </div>
    </li>
  );
}
