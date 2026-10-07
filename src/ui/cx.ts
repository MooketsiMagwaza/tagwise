export type ClassValue = string | false | null | undefined;

/** Joins the truthy class names. Every component composes its module classes
 *  with this — no dependency needed for a one-liner. */
export const cx = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');
