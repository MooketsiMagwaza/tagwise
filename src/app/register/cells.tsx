import type { ReactNode } from 'react';
import { daysUntil, dueLabel, relativeTime, shortDate } from '../../lib/format';
import styles from './cells.module.css';

export function Code({ children }: { children: ReactNode }) {
  return <span className={styles.code}>{children}</span>;
}

export function Primary({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <span className={styles.primary}>
      <span className={styles.title}>{title}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </span>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className={styles.muted}>{children}</span>;
}

export function Due({ date }: { date?: string }) {
  if (!date) return <Muted>–</Muted>;
  const d = daysUntil(date) ?? 0;
  return (
    <span className={d < 0 ? styles.overdue : d <= 3 ? styles.soon : undefined} title={shortDate(date)}>
      {dueLabel(date)}
    </span>
  );
}

export function Ago({ iso }: { iso?: string }) {
  return (
    <span className={styles.muted} title={shortDate(iso)}>
      {relativeTime(iso)}
    </span>
  );
}

export function Quantity({ qty, reorderAt, unit }: { qty: number; reorderAt: number; unit?: string }) {
  const low = qty <= reorderAt;
  return (
    <span className={low ? styles.low : undefined}>
      <strong className={styles.qty}>{qty}</strong>
      {unit && <span className={styles.muted}> {unit}</span>}
      {low && <span className={styles.lowTag}>{qty === 0 ? 'Out' : 'Low'}</span>}
    </span>
  );
}

export function Expiry({ date }: { date?: string }) {
  if (!date) return <Muted>–</Muted>;
  const d = daysUntil(date) ?? 999;
  return <span className={d < 0 ? styles.overdue : d <= 60 ? styles.soon : undefined}>{d < 0 ? `expired ${shortDate(date)}` : shortDate(date)}</span>;
}

/** The phone card layout for one register row. */
export function RowCard({ code, title, meta, trailing }: { code: ReactNode; title: ReactNode; meta: ReactNode; trailing?: ReactNode }) {
  return (
    <span className={styles.card}>
      <span className={styles.cardTop}>
        <Code>{code}</Code>
        {trailing}
      </span>
      <span className={styles.cardTitle}>{title}</span>
      <span className={styles.detail}>{meta}</span>
    </span>
  );
}
