import { describe, expect, it } from 'vitest';
import { guardCell, toCsv } from './csv';

describe('csv', () => {
  it('neutralises cells that a spreadsheet would run as formulas', () => {
    expect(guardCell('=HYPERLINK("http://x")')).toBe(`'=HYPERLINK("http://x")`);
    expect(guardCell('+27 71 000 0000')).toBe(`'+27 71 000 0000`);
    expect(guardCell('@SUM(A1)')).toBe(`'@SUM(A1)`);
    expect(guardCell('-1+1')).toBe(`'-1+1`);
  });
  it('leaves real numbers and plain text alone', () => {
    expect(guardCell(-4)).toBe(-4);
    expect(guardCell('Projector')).toBe('Projector');
  });
  it('quotes commas, quotes and new lines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'one\ntwo']])).toBe('"a,b","say ""hi""","one\ntwo"');
  });
});
