import type { ComponentPropsWithoutRef } from 'react';
import { cx } from '../cx';
import styles from './Layout.module.css';

/** Spacing steps — map to the theme's space tokens, never raw numbers. */
export type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Layout primitives take no `className` or `style`: a screen arranges things
// with these props and nothing else, so styling can't leak back into screens.
type Bare<T extends keyof JSX.IntrinsicElements> = Omit<ComponentPropsWithoutRef<T>, 'className' | 'style'>;

export function Stack({
  gap = 'md',
  align,
  ...rest
}: Bare<'div'> & { gap?: Gap; align?: 'start' | 'center' | 'end' | 'stretch' }) {
  return <div {...rest} className={cx(styles.stack, styles[`gap-${gap}`], align && styles[`align-${align}`])} />;
}

/** A form that lays its fields out as a Stack. */
export function Form({ gap = 'md', ...rest }: Bare<'form'> & { gap?: Gap }) {
  return <form {...rest} className={cx(styles.stack, styles[`gap-${gap}`])} />;
}

export function Row({
  gap = 'sm',
  align = 'center',
  justify = 'start',
  wrap = false,
  ...rest
}: Bare<'div'> & {
  gap?: Gap;
  align?: 'start' | 'center' | 'end' | 'baseline';
  justify?: 'start' | 'center' | 'between' | 'end';
  wrap?: boolean;
}) {
  return (
    <div
      {...rest}
      className={cx(styles.row, styles[`gap-${gap}`], styles[`align-${align}`], styles[`justify-${justify}`], wrap && styles.wrap)}
    />
  );
}

/** Responsive columns of at least `min` px each. `fit` stretches the columns
 *  to fill the row (stat tiles); the default keeps cards a steady size. */
export function Grid({
  min = 220,
  gap = 'md',
  fit = false,
  ...rest
}: Bare<'div'> & { min?: number; gap?: Gap; fit?: boolean }) {
  return (
    <div
      {...rest}
      className={cx(styles.grid, fit ? styles.fit : styles.fill, styles[`gap-${gap}`])}
      style={{ '--min': `${min}px` } as React.CSSProperties}
    />
  );
}

/** The root of every screen: a padded column with a short fade-in. */
export function View(props: Bare<'div'>) {
  return <div {...props} className={cx(styles.stack, styles['gap-lg'], styles.view)} />;
}
