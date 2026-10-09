import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A pill-shaped link — the site's one button shape. `primary` is the accent
 * fill, `secondary` a quiet tint, `link` the plain blue text link with a
 * chevron that Apple uses for "learn more".
 */
export function Pill({
  href,
  variant = 'primary',
  external = false,
  children,
}: {
  href: string;
  variant?: 'primary' | 'secondary' | 'link';
  external?: boolean;
  children: ReactNode;
}) {
  const look =
    variant === 'primary'
      ? 'rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)]'
      : variant === 'secondary'
        ? 'rounded-full bg-[var(--color-fill)] px-5 py-2.5 text-fd-foreground hover:bg-[var(--color-fill-hover)]'
        : 'text-[var(--color-accent-text)] hover:underline underline-offset-4';
  const className = `inline-flex items-center gap-1 text-[1.0625rem] font-medium no-underline transition-colors ${look}`;
  const label = (
    <>
      {children}
      {variant === 'link' ? <span aria-hidden="true">›</span> : null}
    </>
  );
  return external ? (
    <a href={href} className={className} rel="noopener">
      {label}
    </a>
  ) : (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
