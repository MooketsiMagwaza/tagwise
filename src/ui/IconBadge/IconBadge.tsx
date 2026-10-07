import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './IconBadge.module.css';

export type BadgeTone = 'accent' | 'indigo' | 'warning' | 'teal';

/** A glyph on a soft tinted tile — stat tiles, empty product images. */
export function IconBadge({
  tone = 'accent',
  size = 'md',
  children,
}: {
  tone?: BadgeTone;
  size?: 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <span className={cx(styles.badge, styles[tone], size === 'lg' && styles.lg)} aria-hidden="true">
      {children}
    </span>
  );
}
