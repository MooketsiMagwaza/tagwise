import type { ReactNode } from 'react';
import { Link } from '../../lib/router';
import { cx } from '../cx';
import styles from './Segmented.module.css';

/** A pill-shaped choice between a few options; the chosen one is raised.
 *  `fit` sizes segments to their labels (for saved views and other lists
 *  that can grow); the track then scrolls sideways inside itself rather
 *  than pushing the page wider. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  fit = false,
}: {
  /** What the group chooses, for assistive tech ("Price tier"). */
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  fit?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cx(styles.group, fit && styles.fit)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cx(styles.option, value === option.value && styles.selected)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The same control for moving between sections of a page: real links,
 *  with the current one marked for assistive tech (aria-current). */
export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: ReactNode; current: boolean }[] }) {
  return (
    <nav aria-label={label} className={cx(styles.group, styles.fit)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined} className={cx(styles.option, item.current && styles.selected)}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
