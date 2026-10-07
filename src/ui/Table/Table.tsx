import type { ComponentPropsWithoutRef } from 'react';
import { cx } from '../cx';
import styles from './Table.module.css';

type Bare<T extends 'table' | 'th' | 'td'> = Omit<ComponentPropsWithoutRef<T>, 'className' | 'style'>;

/** A plain semantic table. Write ordinary <thead>/<tbody>/<tr>; the look
 *  comes from here. Scrolls sideways on narrow screens instead of squeezing. */
export function Table(props: Bare<'table'>) {
  return (
    <div className={styles.scroll}>
      <table {...props} className={styles.table} />
    </div>
  );
}

export function Th({ align, ...rest }: Bare<'th'> & { align?: 'right' }) {
  return <th {...rest} className={cx(align === 'right' && styles.right)} />;
}

export function Td({ align, shrink, ...rest }: Bare<'td'> & { align?: 'right'; shrink?: boolean }) {
  return <td {...rest} className={cx(align === 'right' && styles.right, shrink && styles.shrink)} />;
}
