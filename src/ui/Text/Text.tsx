import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cx } from '../cx';
import styles from './Text.module.css';

export type TextVariant = 'display' | 'title' | 'headline' | 'body' | 'small' | 'caption';
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'warning' | 'danger';

const DEFAULT_TAG: Record<TextVariant, ElementType> = {
  display: 'h1',
  title: 'h2',
  headline: 'h2',
  body: 'p',
  small: 'p',
  caption: 'p',
};

/** All typography goes through here, so the scale (and the theme's fonts)
 *  are applied in one place. `as` changes the element, not the look. */
export function Text({
  as,
  variant = 'small',
  tone = 'primary',
  weight,
  align,
  mono,
  ...rest
}: Omit<ComponentPropsWithoutRef<'p'>, 'className' | 'style'> & {
  as?: ElementType;
  variant?: TextVariant;
  tone?: TextTone;
  weight?: 'regular' | 'medium' | 'semibold';
  align?: 'start' | 'center' | 'end';
  /** Monospaced: tag codes, SKUs, barcodes. */
  mono?: boolean;
}) {
  const Tag = as ?? DEFAULT_TAG[variant];
  return (
    <Tag
      {...rest}
      className={cx(styles[variant], styles[tone], weight && styles[weight], align && styles[`align-${align}`], mono && styles.mono)}
    />
  );
}
