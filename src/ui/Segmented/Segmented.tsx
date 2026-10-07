import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Segmented.module.css';

/** A pill-shaped choice between a few options; the chosen one is raised. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** What the group chooses, for assistive tech ("Price tier"). */
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
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
