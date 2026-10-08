import { describe, expect, it } from 'vitest';
import { checkAssetRows, checkStockRows, guessMapping, parseDate, problemReport, type ImportContext } from './importer';
import { createSeed } from './seed';
import { sampleRegisterRows } from '../lib/sheet';

const seed = createSeed(new Date('2026-10-07T09:00:00Z'));
const ctx: ImportContext = { sites: seed.sites, places: seed.places, people: seed.people, assets: seed.assets, stock: seed.stock };

describe('importer', () => {
  it('guesses columns from common header spellings', () => {
    const m = guessMapping(['Asset tag', 'Description', 'Type', 'Location', 'Serial no', 'Cost (BWP)'], 'assets');
    expect(m).toMatchObject({ tag: 0, name: 1, category: 2, site: 3, serial: 4, cost: 5 });
  });

  it('reads ISO, day/month/year and Excel serial dates, and rejects impossible ones', () => {
    expect(parseDate('2025-03-14')).toBe('2025-03-14');
    expect(parseDate('14/03/2025')).toBe('2025-03-14');
    expect(parseDate('45730')).toBe('2025-03-14');
    expect(parseDate('31/02/2025')).toBeNull();
  });

  it('finds every deliberate problem in the sample register', () => {
    const [headers, ...rows] = sampleRegisterRows();
    const checks = checkAssetRows(rows, guessMapping(headers.map(String), 'assets'), ctx);
    const byRow = (n: number) => checks.find((c) => c.rowNumber === n)!;
    expect(byRow(8).duplicate).toBe('register'); // MCT-00001 already exists
    expect(byRow(11).errors[0].message).toMatch(/No site called "Lobatse depot"/);
    expect(byRow(12).errors[0].message).toMatch(/not a date/);
    expect(byRow(13).errors[0].message).toMatch(/Unknown status "Wobbly"/);
    expect(byRow(14).errors.some((e) => /negative/.test(e.message))).toBe(true);
    expect(byRow(15).duplicate).toBe('file');
    expect(byRow(19).warnings.some((w) => /formula/.test(w.message))).toBe(true);
    expect(byRow(10).value?.status).toBe('in_repair'); // "Faulty" maps to In repair
    const ok = checks.filter((c) => c.value).length;
    expect(ok).toBe(13);
  });

  it('writes one report line per problem', () => {
    const [headers, ...rows] = sampleRegisterRows();
    const checks = checkAssetRows(rows, guessMapping(headers.map(String), 'assets'), ctx);
    const report = problemReport(checks, 'assets');
    expect(report[0]).toEqual(['Row', 'Column', 'Problem', 'Value in the file', 'Severity']);
    expect(report.some((r) => r[0] === '11' && r[1] === 'Site')).toBe(true);
  });

  it('rejects a bad EAN-13 and a negative quantity for stock', () => {
    const mapping = guessMapping(['SKU', 'Item', 'Site', 'Qty', 'Barcode'], 'stock');
    const checks = checkStockRows(
      [
        ['PAP-A4-80', 'A4 paper', 'Central store', '12', '2000000000001'],
        ['GLV-X', 'Gloves', 'Central store', '-3', ''],
      ],
      mapping,
      ctx,
    );
    expect(checks[0].errors[0].field).toBe('barcode');
    expect(checks[1].errors[0].message).toMatch(/negative/);
  });
});
