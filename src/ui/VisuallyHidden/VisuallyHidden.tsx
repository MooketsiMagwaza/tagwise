import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/** Text for screen readers only. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles.hidden}>{children}</span>;
}
