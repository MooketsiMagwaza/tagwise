import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * A rounded card that is one big link: a headline, a sentence, and a quiet
 * "›" that says it goes somewhere. In-flow surfaces are flat and separated by
 * colour, as in the app — no shadow, no border, no gradient.
 */
export function Tile({
  href,
  title,
  external = false,
  children,
}: {
  href: string;
  title: string;
  external?: boolean;
  children: ReactNode;
}) {
  const className =
    'group flex flex-col gap-2 rounded-3xl bg-fd-card p-7 text-fd-card-foreground no-underline transition-colors hover:bg-[var(--color-fill-hover)]';
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-4 text-[1.3125rem] font-semibold tracking-tight">
        {title}
        <span aria-hidden="true" className="text-[var(--color-accent-text)] transition-transform group-hover:translate-x-0.5">
          ›
        </span>
      </span>
      <span className="text-[0.9375rem] leading-relaxed text-fd-muted-foreground">{children}</span>
    </>
  );
  return external ? (
    <a href={href} className={className} rel="noopener">
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
