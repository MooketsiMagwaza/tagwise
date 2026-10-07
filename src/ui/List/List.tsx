import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Text } from '../Text/Text';
import styles from './List.module.css';

export function List({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

/** One row: an icon, a title and body, and a line of meta. Give it `onClick`
 *  and the whole row becomes a real button; `unread` marks it with a dot. */
export function ListItem({
  icon,
  title,
  body,
  meta,
  unread = false,
  marker = true,
  trailing,
  trailingActions = false,
  onClick,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  meta?: string;
  unread?: boolean;
  /** Reserve the left column for the unread dot (notifications). Off for plain lists. */
  marker?: boolean;
  trailing?: ReactNode;
  /** `trailing` holds buttons of its own. Then it sits beside the row's button
   *  instead of inside it — a button can't contain a button — and clicking it
   *  doesn't open the row. */
  trailingActions?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      {marker && <span className={cx(styles.dot, unread && styles.unread)} aria-hidden="true" />}
      {icon && <span className={styles.icon}>{icon}</span>}
      <span className={styles.text}>
        <Text as="span" variant="small" weight={unread ? 'semibold' : 'medium'}>
          {title}
        </Text>
        {body && (
          <Text as="span" variant="small" tone="secondary">
            {body}
          </Text>
        )}
        {meta && (
          <Text as="span" variant="caption" tone="secondary">
            {meta}
          </Text>
        )}
      </span>
      {trailing && !(onClick && trailingActions) && <span className={styles.trailing}>{trailing}</span>}
    </>
  );

  return (
    <li className={cx(styles.item, !!(onClick && trailing && trailingActions) && styles.split)}>
      {onClick ? (
        <>
          <button type="button" className={cx(styles.row, styles.action)} onClick={onClick}>
            {unread && <span className={styles.sr}>Unread. </span>}
            {content}
          </button>
          {trailing && trailingActions && <span className={cx(styles.trailing, styles.beside)}>{trailing}</span>}
        </>
      ) : (
        <div className={styles.row}>{content}</div>
      )}
    </li>
  );
}
