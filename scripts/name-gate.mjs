// Name gate: Tagwise must not carry the names of the owner's other products
// in its code, copy or assets. Fails (exit 1) when a tracked file mentions
// one. PROVENANCE.md and the work-order register are exempt because they
// exist to record where code came from.
//
// Run: npm run check:names
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const FORBIDDEN = /\b(stock\s?link|tsela|transitos|combis?)\b/i;
const EXEMPT = new Set(['PROVENANCE.md', 'docs/WORK_ORDERS.md', 'scripts/name-gate.mjs']);
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|xlsx|pdf)$/i;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((f) => !EXEMPT.has(f) && !BINARY.test(f) && f !== 'package-lock.json');

const hits = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    const m = line.match(FORBIDDEN);
    if (m) hits.push(`${file}:${i + 1}: "${m[0]}"`);
  });
}

if (hits.length) {
  console.error(`Name gate: ${hits.length} mention(s) of another product's name:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`Name gate: ${files.length} files checked, no other product names found.`);
