import type { CSSProperties } from 'react';
import { cx } from '../cx';
import styles from './Avatar.module.css';

/** Initials in a softly tinted circle. Decorative by default (hidden from
 *  assistive tech); pass `label` when the avatar stands alone and must say who. */
export function Avatar({
  initials,
  hue,
  size = 'md',
  ring,
  label,
}: {
  initials: string;
  /** A CSS colour for the tint (a member's colour). */
  hue?: string;
  size?: 'sm' | 'md' | 'lg';
  /** A coloured ring: someone present on this page right now. */
  ring?: string;
  label?: string;
}) {
  const style = { '--hue': hue, '--ring': ring } as CSSProperties;
  return (
    <span
      className={cx(styles.avatar, size !== 'md' && styles[size])}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      title={label}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}
