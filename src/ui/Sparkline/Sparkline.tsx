import { cx } from '../cx';
import styles from './Sparkline.module.css';

/** A small honest trend line: real values, no fabricated data. Renders flat
 *  when there isn't enough real history for a slope — that's the truth, not a
 *  placeholder pretending otherwise. One stroke, no fill, no gradient. */
export function Sparkline({ points, tone = 'accent' }: { points: number[]; tone?: 'accent' | 'success' | 'teal' }) {
  const w = 84;
  const h = 28;
  const series = points.length ? points : [0, 0];
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const step = w / Math.max(series.length - 1, 1);
  const d = series.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg className={cx(styles.spark, styles[tone])} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
