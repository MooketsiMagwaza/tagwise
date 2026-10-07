import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './RadioList.module.css';

export interface RadioOption<T extends string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  /** Something quiet on the right (a "Default" pill). */
  trailing?: ReactNode;
}

/** Pick one of a few choices, each a tile with a title and a line of detail.
 *  Real radio inputs, so arrow keys and screen readers behave. */
export function RadioList<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: RadioOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.list}>
      {options.map((o) => (
        <label key={o.value} className={cx(styles.option, value === o.value && styles.chosen)}>
          <input
            type="radio"
            name={name}
            className={styles.input}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.text}>
            <span className={styles.title}>{o.title}</span>
            {o.description && <span className={styles.description}>{o.description}</span>}
          </span>
          {o.trailing && <span className={styles.trailing}>{o.trailing}</span>}
        </label>
      ))}
    </div>
  );
}
