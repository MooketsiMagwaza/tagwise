import type { ReactNode } from 'react';
import styles from './Callout.module.css';

/** A short highlighted note — used to label development-only behaviour on
 *  screen so it can never be mistaken for the real thing. */
export function Callout({ children }: { children: ReactNode }) {
  return <p className={styles.callout}>{children}</p>;
}
