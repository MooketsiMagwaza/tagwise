import type { Screen } from '@/lib/screens';

/**
 * One captured page, in the light or dark version that matches the reader's
 * theme. The two images are always both in the page; CSS shows one. They are
 * sample data, and the caption says what they are.
 */
export function ScreenShot({ shot, caption }: { shot: Screen; caption: string }) {
  const size = { width: shot.width, height: shot.height };
  return (
    <figure className="m-0 overflow-hidden rounded-3xl bg-fd-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/screens/${shot.light}`} alt={`${caption} (light)`} {...size} className="block h-auto w-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/screens/${shot.dark}`} alt={`${caption} (dark)`} {...size} className="hidden h-auto w-full dark:block" />
      <figcaption className="px-6 py-4 text-[0.8125rem] text-fd-muted-foreground">
        {caption} — sample data
      </figcaption>
    </figure>
  );
}
