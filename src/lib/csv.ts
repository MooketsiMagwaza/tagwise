// CSV writing with a formula guard. A cell that starts with = + - @ (or a tab
// or carriage return) would run as a formula when the file is opened in a
// spreadsheet, so it gets a leading apostrophe. Numbers are left alone.

const RISKY = /^[=+\-@\t\r]/;

export function guardCell(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value);
  return RISKY.test(text) ? `'${text}` : text;
}

function quote(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((cell) => quote(guardCell(cell))).join(',')).join('\r\n');
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(rows: unknown[][], fileName: string) {
  // The byte-order mark makes Excel read the file as UTF-8.
  downloadBlob(new Blob(['﻿', toCsv(rows)], { type: 'text/csv;charset=utf-8' }), fileName);
}
