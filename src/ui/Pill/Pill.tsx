import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Pill.module.css';

export type PillTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'brand';

/** A small status label. The soft background is derived from the tone in
 *  CSS, so a new tone is one line in the module, not a new colour pair. */
export function Pill({
  tone = 'neutral',
  size = 'md',
  dot = false,
  children,
}: {
  tone?: PillTone;
  size?: 'sm' | 'md';
  /** A leading dot, for status columns. */
  dot?: boolean;
  children: ReactNode;
}) {
  return <span className={cx(styles.pill, styles[tone], size === 'sm' && styles.sm, dot && styles.dot)}>{children}</span>;
}
