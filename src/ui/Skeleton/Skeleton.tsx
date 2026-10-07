import { Card } from '../Card/Card';
import styles from './Skeleton.module.css';

/** Placeholder bars for content mid-load — a user should never sit on a blank
 *  screen while a query is in flight. A flat opacity pulse, not a moving
 *  gradient sweep (no gradients, AGENTS.md rule 7). */
export function SkeletonLines({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.lines} role="status" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.line} style={{ width: `${85 - i * 15}%` }} />
      ))}
    </div>
  );
}

/** A whole card of placeholder bars, for grids and screen-level loading. */
export function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card>
      <SkeletonLines rows={rows} />
    </Card>
  );
}

export function StatSkeleton() {
  return (
    <Card>
      <div className={styles.lines} role="status" aria-busy="true" aria-label="Loading">
        <div className={styles.line} style={{ width: '45%', height: '0.625rem' }} />
        <div className={styles.line} style={{ width: '65%', height: '1.75rem' }} />
      </div>
    </Card>
  );
}
