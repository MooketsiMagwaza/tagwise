import type { ReactNode } from 'react';
import styles from './Clickable.module.css';

/** Makes a block of content (a product's picture and name) one real button,
 *  without giving it any button look of its own. */
export function Clickable({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} className={styles.clickable} onClick={onClick}>
      {children}
    </button>
  );
}
