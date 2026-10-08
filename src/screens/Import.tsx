import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Banner, Button, ButtonLink, Card, CardHeader, RadioList, Row, Segmented, Steps, Text, type Step } from '../ui';
import { useLocation } from '../lib/router';
import { useToast } from '../lib/toast';
import { downloadCsv } from '../lib/csv';
import { downloadXlsx, MAX_ROWS, readSpreadsheet, sampleRegisterFile, sampleRegisterRows, SheetError, type ParsedSheet } from '../lib/sheet';
import { checkAssetRows, checkStockRows, guessMapping, problemReport, TARGET_FIELDS, type ImportTarget, type RowCheck } from '../data/importer';
import { repo, useMe, useQuery } from '../data/hooks';
import type { DuplicateMode, ImportSummary } from '../data/repository';
import { ScreenHeader } from '../app/bits';
import styles from './Import.module.css';

type Stage = 'upload' | 'map' | 'check' | 'done';
type Mapping = Record<string, number | null>;

const MAPPING_KEY = (t: ImportTarget) => `tagwise.importMapping.${t}`;

function savedMapping(target: ImportTarget, headers: string[]): Mapping | null {
  try {
    const raw = JSON.parse(localStorage.getItem(MAPPING_KEY(target)) ?? 'null') as { headers: string[]; mapping: Mapping } | null;
    return raw && JSON.stringify(raw.headers) === JSON.stringify(headers) ? raw.mapping : null;
  } catch {
    return null;
  }
}

export default function Import() {
  const { search } = useLocation();
  const { me, can } = useMe();
  const toast = useToast();
  const [target, setTarget] = useState<ImportTarget>(search.get('to') === 'stock' ? 'stock' : 'assets');
  const [stage, setStage] = useState<Stage>('upload');
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<'all' | 'problems' | 'duplicates'>('all');
  const [mode, setMode] = useState<DuplicateMode>('skip');
  const [result, setResult] = useState<ImportSummary | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const sites = useQuery((r) => r.sites(), []);
  const places = useQuery((r) => r.places(), []);
  const people = useQuery((r) => r.people(), []);
  const assets = useQuery((r) => r.assets(), []);
  const stock = useQuery((r) => r.stock(), []);

  const fields = TARGET_FIELDS[target];
  const checks: RowCheck<unknown>[] = useMemo(() => {
    if (!sheet || stage === 'upload' || stage === 'map') return [];
    const ctx = { sites: sites.data ?? [], places: places.data ?? [], people: people.data ?? [], assets: assets.data ?? [], stock: stock.data ?? [] };
    return target === 'assets' ? checkAssetRows(sheet.rows, mapping, ctx) : checkStockRows(sheet.rows, mapping, ctx);
    // Re-check only when the file, mapping or step changes, not on every register update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, mapping, target, stage]);

  const ready = checks.filter((c) => c.value);
  const bad = checks.filter((c) => !c.value);
  const dupes = checks.filter((c) => c.duplicate === 'register');
  const warned = checks.filter((c) => c.value && c.warnings.length);
  const shown = filter === 'problems' ? checks.filter((c) => c.errors.length || c.warnings.length) : filter === 'duplicates' ? checks.filter((c) => c.duplicate) : checks;

  async function open(file: File) {
    setError(null);
    setBusy(true);
    try {
      const parsed = await readSpreadsheet(file);
      setSheet(parsed);
      setMapping(savedMapping(target, parsed.headers) ?? guessMapping(parsed.headers, target));
      setStage('map');
    } catch (e) {
      setError(e instanceof SheetError ? e.message : 'The file could not be read.');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!me || !sheet) return;
    setBusy(true);
    const rows = ready.map((c) => c.value);
    const summary =
      target === 'assets'
        ? await repo().importAssets(rows as Parameters<ReturnType<typeof repo>['importAssets']>[0], mode, sheet.fileName, me.id)
        : await repo().importStock(rows as Parameters<ReturnType<typeof repo>['importStock']>[0], mode, sheet.fileName, me.id);
    setResult(summary);
    setStage('done');
    setBusy(false);
    toast.push(`Imported ${summary.created + summary.updated} rows`);
  }

  function report() {
    if (!sheet) return;
    downloadCsv(problemReport(checks, target), `${sheet.fileName.replace(/\.[^.]+$/, '')}-problems.csv`);
  }

  const order: Stage[] = ['upload', 'map', 'check', 'done'];
  const steps: Step[] = [
    { label: 'Choose a file', state: 'todo' },
    { label: 'Match columns', state: 'todo' },
    { label: 'Check rows', state: 'todo' },
    { label: 'Import', state: 'todo' },
  ].map((s, i) => ({ ...s, state: i < order.indexOf(stage) ? 'done' : i === order.indexOf(stage) ? 'current' : 'todo' }));

  if (!can('import')) {
    return (
      <>
        <ScreenHeader title="Import" />
        <Card>
          <Text>Your role cannot import. Editors, admins and owners can.</Text>
        </Card>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <ScreenHeader title="Import a spreadsheet" subtitle="Bring an existing register in from Excel or CSV. Nothing is written until you have seen every problem." />
      <Steps steps={steps} tone="success" />

      {stage === 'upload' && (
        <div className={styles.uploadGrid}>
          <Card>
            <div className={styles.stack}>
              <Segmented<ImportTarget>
                label="What the file holds"
                value={target}
                onChange={setTarget}
                options={[
                  { value: 'assets', label: 'Assets (tagged items)' },
                  { value: 'stock', label: 'Stock (quantities)' },
                ]}
              />
              <label
                className={`${styles.drop} ${dragging ? styles.dragging : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) open(f);
                }}
              >
                <Upload size={28} aria-hidden="true" />
                <span className={styles.dropTitle}>{busy ? 'Reading the file…' : 'Drop a file here, or choose one'}</span>
                <span className={styles.dropHint}>.xlsx, .xls or .csv · up to 5 MB and {MAX_ROWS.toLocaleString('en-GB')} rows · macro files (.xlsm) are refused</span>
                <input
                  ref={input}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className={styles.fileInput}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) open(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {error && (
                <Banner tone="warning" icon={<AlertTriangle size={16} />}>
                  {error}
                </Banner>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="No file to hand?" />
            <div className={styles.stack}>
              <Text tone="secondary">
                The practice register has 18 rows for a fictional school trust, with six problems planted in it: a tag already in the register, a tag used twice, a site that does not exist, 31 February, a negative cost, and an unknown condition.
              </Text>
              <Row wrap>
                <Button
                  icon={<FileSpreadsheet size={16} />}
                  onClick={async () => {
                    setTarget('assets');
                    open(await sampleRegisterFile());
                  }}
                >
                  Use the practice register
                </Button>
                <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadXlsx(sampleRegisterRows(), 'sample-school-trust-register.xlsx', 'Register')}>
                  Download it
                </Button>
              </Row>
            </div>
          </Card>
        </div>
      )}

      {stage === 'map' && sheet && (
        <Card>
          <CardHeader title="Match your columns" meta={`${sheet.fileName} · sheet "${sheet.sheet}" · ${sheet.rows.length} rows`} />
          {sheet.truncated && (
            <div className={styles.notice}>
              <Banner tone="warning">Only the first {MAX_ROWS.toLocaleString('en-GB')} rows will be checked. Split the file to import the rest.</Banner>
            </div>
          )}
          <div className={styles.mapTable}>
            <table>
              <thead>
                <tr>
                  <th>Tagwise field</th>
                  <th>Column in your file</th>
                  <th>First values</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => {
                  const idx = mapping[f.key];
                  return (
                    <tr key={f.key}>
                      <th scope="row">
                        {f.label}
                        {f.required && <span className={styles.required}> required</span>}
                        {f.hint && <span className={styles.fieldHint}>{f.hint}</span>}
                      </th>
                      <td>
                        <select
                          className={styles.select}
                          aria-label={`Column for ${f.label}`}
                          value={idx == null ? '' : String(idx)}
                          onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value === '' ? null : Number(e.target.value) })}
                        >
                          <option value="">Not in this file</option>
                          {sheet.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={styles.sample}>{idx == null ? '–' : sheet.rows.slice(0, 2).map((r) => String(r[idx] ?? '')).filter(Boolean).join(' · ') || 'empty'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Row justify="between" wrap>
            <Button variant="secondary" onClick={() => setStage('upload')}>
              Choose another file
            </Button>
            <Button
              disabled={fields.some((f) => f.required && mapping[f.key] == null)}
              onClick={() => {
                try {
                  localStorage.setItem(MAPPING_KEY(target), JSON.stringify({ headers: sheet.headers, mapping }));
                } catch {
                  /* not remembered */
                }
                setStage('check');
              }}
            >
              Check the rows
            </Button>
          </Row>
        </Card>
      )}

      {stage === 'check' && sheet && (
        <>
          <div className={styles.summary}>
            <span className={styles.good}>
              <CheckCircle2 size={16} /> {ready.length} ready{warned.length ? `, ${warned.length} with warnings` : ''}
            </span>
            <span className={styles.bad}>
              <AlertTriangle size={16} /> {bad.length} with errors (not imported)
            </span>
            <span className={styles.dupe}>{dupes.length} already in the register</span>
          </div>

          <Card padding="none">
            <div className={styles.checkHead}>
              <Segmented
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: `All ${checks.length}` },
                  { value: 'problems', label: `Problems ${checks.filter((c) => c.errors.length || c.warnings.length).length}` },
                  { value: 'duplicates', label: `Duplicates ${checks.filter((c) => c.duplicate).length}` },
                ]}
              />
              <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={report} disabled={!bad.length && !warned.length}>
                Problem report (CSV)
              </Button>
            </div>
            <div className={styles.checkTable}>
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    {fields.filter((f) => mapping[f.key] != null).map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th>Problems</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.rowNumber} className={c.errors.length ? styles.rowBad : c.duplicate === 'register' ? styles.rowDupe : undefined}>
                      <td className={styles.rowNum}>{c.rowNumber}</td>
                      {fields.filter((f) => mapping[f.key] != null).map((f) => {
                        const err = c.errors.find((p) => p.field === f.key);
                        const warn = c.warnings.find((p) => p.field === f.key);
                        return (
                          <td key={f.key} className={err ? styles.cellBad : warn ? styles.cellWarn : undefined} title={err?.message ?? warn?.message}>
                            {c.cells[f.key] || <span className={styles.empty}>–</span>}
                          </td>
                        );
                      })}
                      <td className={styles.problems}>
                        {c.errors.map((p, i) => (
                          <span key={`e${i}`} className={styles.err}>
                            {p.message}
                          </span>
                        ))}
                        {c.warnings.map((p, i) => (
                          <span key={`w${i}`} className={styles.warn}>
                            {p.message}
                          </span>
                        ))}
                        {c.duplicate === 'register' && <span className={styles.dupeNote}>Already in the register</span>}
                        {!c.errors.length && !c.warnings.length && !c.duplicate && <span className={styles.ok}>Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className={styles.commitGrid}>
              <div>
                <Text as="h2" variant="headline">
                  Rows already in the register
                </Text>
                <Text tone="secondary">{dupes.length ? `${dupes.length} rows match an existing ${target === 'assets' ? 'tag' : 'SKU at the same site'}.` : 'None in this file.'}</Text>
              </div>
              <RadioList<DuplicateMode>
                label="What to do with rows already in the register"
                name="dupes"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'skip', title: 'Skip them', description: 'Keep the register as it is.' },
                  { value: 'update', title: 'Update them', description: 'Overwrite the fields in the file; the history records it.' },
                  { value: 'create', title: 'Add them as new', description: target === 'assets' ? 'They get new tags.' : 'A second line is created.' },
                ]}
              />
            </div>
            <Row justify="between" wrap>
              <Button variant="secondary" onClick={() => setStage('map')}>
                Back to columns
              </Button>
              <Button onClick={commit} disabled={busy || !ready.length}>
                Import {ready.length} {ready.length === 1 ? 'row' : 'rows'}
              </Button>
            </Row>
          </Card>
        </>
      )}

      {stage === 'done' && result && sheet && (
        <Card>
          <div className={styles.done}>
            <CheckCircle2 size={32} className={styles.doneIcon} aria-hidden="true" />
            <Text as="h2" variant="title">
              Imported from {sheet.fileName}
            </Text>
            <Text tone="secondary">
              {result.created} added, {result.updated} updated, {result.skipped} skipped as duplicates, {bad.length} not imported because of errors. It is in the activity log.
            </Text>
            <Row wrap justify="center">
              {bad.length > 0 && (
                <Button variant="secondary" icon={<Download size={16} />} onClick={report}>
                  Problem report (CSV)
                </Button>
              )}
              <ButtonLink href={target === 'assets' ? '/app/assets' : '/app/stock'}>Open the register</ButtonLink>
              <Button
                variant="ghost"
                onClick={() => {
                  setSheet(null);
                  setResult(null);
                  setStage('upload');
                }}
              >
                Import another file
              </Button>
            </Row>
          </div>
        </Card>
      )}
    </div>
  );
}
