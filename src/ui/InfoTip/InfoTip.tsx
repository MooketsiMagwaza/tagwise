import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './InfoTip.module.css';

/** A small info affordance with a hover/focus note — CSS-only, no portal or
 *  positioning script needed for a note this short. */
export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <span className={styles.tooltip} tabIndex={0}>
      <Info size={13} />
      <span role="tooltip" className={styles.tip}>
        {children}
      </span>
    </span>
  );
}
