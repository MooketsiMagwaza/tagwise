// Reading and writing spreadsheets with SheetJS (loaded on demand, since it
// is the largest library in the app). Reading is defensive: size and row
// caps, macro-enabled files refused, formulas read as their saved values.
// Writing applies the same formula guard as CSV.

import { guardCell } from './csv';
import { downloadBlob } from './csv';

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;
const ALLOWED = /\.(xlsx|xls|csv)$/i;

export interface ParsedSheet {
  fileName: string;
  sheetNames: string[];
  sheet: string;
  headers: string[];
  rows: unknown[][];
  truncated: boolean;
}

export class SheetError extends Error {}

export async function readSpreadsheet(file: File, sheetName?: string): Promise<ParsedSheet> {
  if (/\.xlsm$/i.test(file.name)) throw new SheetError('Macro-enabled workbooks (.xlsm) are refused. Save a copy as .xlsx and try again.');
  if (!ALLOWED.test(file.name)) throw new SheetError('Choose an Excel (.xlsx or .xls) or CSV file.');
  if (file.size > MAX_BYTES) throw new SheetError(`The file is ${(file.size / 1048576).toFixed(1)} MB; the limit is 5 MB.`);
  const XLSX = await import('xlsx');
  const data = new Uint8Array(await file.arrayBuffer());
  let wb;
  try {
    wb = XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false, cellDates: false, dense: true });
  } catch {
    throw new SheetError('The file could not be read as a spreadsheet.');
  }
  const sheet = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  if (!sheet) throw new SheetError('The workbook has no sheets.');
  const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true, defval: '', blankrows: false });
  const headerAt = raw.findIndex((r) => r.some((c) => String(c).trim() !== ''));
  if (headerAt < 0) throw new SheetError('The sheet is empty.');
  const headers = raw[headerAt].map((h, i) => String(h).trim() || `Column ${i + 1}`);
  const body = raw.slice(headerAt + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
  return { fileName: file.name, sheetNames: wb.SheetNames, sheet, headers, rows: body.slice(0, MAX_ROWS), truncated: body.length > MAX_ROWS };
}

export async function downloadXlsx(rows: unknown[][], fileName: string, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(rows.map((r) => r.map(guardCell)));
  ws['!cols'] = (rows[0] ?? []).map((_, i) => ({ wch: Math.min(40, Math.max(8, ...rows.slice(0, 200).map((r) => String(r[i] ?? '').length + 2))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

/** A practice register with deliberate problems, so the checks have
 *  something to find: a tag already in the register, a tag repeated in the
 *  file, a site that does not exist, an impossible date, a negative cost and
 *  an unknown status. Every row is invented. */
export function sampleRegisterRows(): unknown[][] {
  return [
    ['Asset tag', 'Description', 'Type', 'Location', 'Room', 'Condition', 'Make / model', 'Serial no', 'Assigned to', 'Date purchased', 'Cost (BWP)'],
    ['', 'Projector, classroom', 'Projector', 'Mochudi learning centre', 'Classroom 1', 'In use', 'Epson EB-X49', 'PJ880211', '', '2025-01-20', 7800],
    ['', 'Laptop, deputy head', 'Laptop', 'Mochudi learning centre', 'Staff room', 'In use', 'Lenovo ThinkPad E14', 'LT880212', 'Neo Modise', '14/02/2025', 14650],
    ['', 'Microscope', 'Science kit', 'MO', 'Science lab', 'Available', 'Microscope, 40-1000x', 'SC880213', '', '2024-11-03', 2950],
    ['', 'Microscope', 'Science kit', 'MO', 'Science lab', 'Available', 'Microscope, 40-1000x', 'SC880214', '', '2024-11-03', 2950],
    ['', 'Tablet, library', 'Tablet', 'Mochudi learning centre', 'Library', 'Spare', 'Samsung Galaxy Tab A9', 'TB880215', '', '2025-06-30', 3300],
    ['', 'Tablet, library', 'Tablet', 'Mochudi learning centre', 'Library', 'Spare', 'Samsung Galaxy Tab A9', 'TB880216', '', '2025-06-30', 3300],
    ['MCT-00001', 'HP ProBook 450 G10', 'Laptop', 'Head office', 'Reception', 'In use', 'HP ProBook 450 G10', '', '', '', ''],
    ['', 'Blood pressure monitor', 'Medical equipment', 'Molepolole clinic', 'Consulting room 2', 'In use', 'Omron M3', 'MD880218', '', '2025-03-12', 1250],
    ['', 'Examination couch', 'Medical equipment', 'Molepolole clinic', 'Consulting room 1', 'Faulty', '', 'MD880219', '', '2023-09-01', 5400],
    ['', 'Generator 5 kVA', 'Power', 'Lobatse depot', '', 'In use', '', 'PW880220', '', '2024-04-18', 19800],
    ['', 'Desk 1400 mm', 'Furniture', 'Francistown office', 'Main office', 'In use', '', '', '', '31/02/2025', 2100],
    ['', 'Office chair, mesh', 'Furniture', 'Francistown office', 'Main office', 'Wobbly', '', '', '', '2025-02-01', 1450],
    ['MCT-90001', 'Router', 'Network', 'Maun clinic', 'Reception', 'In use', 'MikroTik hEX', 'NW880223', '', '2025-05-05', -1600],
    ['MCT-90001', 'Router, spare', 'Network', 'Maun clinic', 'Reception', 'Available', 'MikroTik hEX', 'NW880224', '', '2025-05-05', 1600],
    ['', 'UPS 1500 VA', 'Power', 'Head office', 'IT room', 'In use', 'APC Back-UPS', 'PW880225', '', '2025-07-09', 2750],
    ['', 'Printer', 'Printer', 'Head office', 'Finance office', 'In use', 'HP LaserJet Pro M404dn', 'PR880226', 'Naledi Sebego', '2024-08-22', 4300],
    ['', 'Vaccine carrier', 'Cold chain', 'Maun clinic', 'Pharmacy store', 'In use', '', 'CC880227', '', '2025-04-02', 4200],
    ['', '=HYPERLINK("http://example.invalid","click")', 'Furniture', 'Head office', 'Boardroom', 'In use', '', '', '', '2025-01-01', 900],
  ];
}

export async function sampleRegisterFile(): Promise<File> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(sampleRegisterRows());
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Register');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([out], 'sample-school-trust-register.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
