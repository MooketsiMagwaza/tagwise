// The register: a Notion-style database table shared by Assets and Stock.
// Saved views as tabs, search, filter chips, sortable columns, a column
// picker, row selection with bulk actions, CSV export of what you see, and
// a card list on phones. Everything reflects changes from other tabs live.

import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Columns3, Download, ListFilter, Plus, Save, X } from 'lucide-react';
import { Button, EmptyState, Form, Input, Modal, Row, TextField } from '../../ui';
import { navigate, useLocation } from '../../lib/router';
import { downloadCsv } from '../../lib/csv';
import { useToast } from '../../lib/toast';
import { describeFilter, type FieldDef, type FieldType, type Lookups } from '../../data/fields';
import { repo, useLookups, useMe, useQuery } from '../../data/hooks';
import type { Collection, FilterOp, SavedView, ViewFilter, ViewSort } from '../../data/types';
import styles from './Register.module.css';

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T, l: Lookups) => ReactNode;
  /** Field key used for sorting; defaults to `key`. */
  sortKey?: string;
  align?: 'right';
  /** Shown unless the view says otherwise. */
  defaultVisible?: boolean;
  /** Never hidden (the identifying column). */
  fixed?: boolean;
}

const OPS: Record<FieldType, { op: FilterOp; label: string }[]> = {
  text: [
    { op: 'contains', label: 'contains' },
    { op: 'is', label: 'is exactly' },
    { op: 'is_empty', label: 'is empty' },
    { op: 'not_empty', label: 'is set' },
  ],
  enum: [
    { op: 'is', label: 'is' },
    { op: 'is_not', label: 'is not' },
  ],
  site: [
    { op: 'is', label: 'is' },
    { op: 'is_not', label: 'is not' },
  ],
  place: [
    { op: 'is_empty', label: 'is empty' },
    { op: 'not_empty', label: 'is set' },
  ],
  person: [
    { op: 'is', label: 'is' },
    { op: 'is_empty', label: 'is nobody' },
    { op: 'not_empty', label: 'is someone' },
  ],
  bool: [{ op: 'is', label: 'is' }],
  number: [
    { op: 'lt', label: 'is under' },
    { op: 'gt', label: 'is over' },
    { op: 'is', label: 'equals' },
  ],
  date: [
    { op: 'before', label: 'is before' },
    { op: 'after', label: 'is after' },
    { op: 'is_empty', label: 'is empty' },
  ],
};

const needsValue = (op: FilterOp) => op !== 'is_empty' && op !== 'not_empty';

function AddFilter<T>({ fields, rows, l, onAdd, onClose }: { fields: FieldDef<T>[]; rows: T[]; l: Lookups; onAdd: (f: ViewFilter) => void; onClose: () => void }) {
  const [fieldKey, setFieldKey] = useState(fields[0].key);
  const field = fields.find((f) => f.key === fieldKey)!;
  const ops = OPS[field.type];
  const [op, setOp] = useState<FilterOp>(ops[0].op);
  const options = field.options?.(rows, l) ?? [];
  const [value, setValue] = useState('');

  useEffect(() => {
    setOp(OPS[field.type][0].op);
    setValue('');
  }, [field.type, fieldKey]);

  return (
    <Modal title="Add a filter" size="sm" onClose={onClose}>
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          if (needsValue(op) && !value) return;
          onAdd({ field: fieldKey, op, value: needsValue(op) ? value : undefined });
        }}
      >
        <label className={styles.label}>
          Field
          <select className={styles.select} value={fieldKey} onChange={(e) => setFieldKey(e.target.value)}>
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Condition
          <select className={styles.select} value={op} onChange={(e) => setOp(e.target.value as FilterOp)}>
            {ops.map((o) => (
              <option key={o.op} value={o.op}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {needsValue(op) &&
          (options.length && (op === 'is' || op === 'is_not') ? (
            <label className={styles.label}>
              Value
              <select className={styles.select} value={value} onChange={(e) => setValue(e.target.value)} required>
                <option value="">Choose…</option>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <TextField
              label="Value"
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              autoFocus
            />
          ))}
        <Row justify="end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add filter</Button>
        </Row>
      </Form>
    </Modal>
  );
}

function ColumnsPicker<T>({ columns, visible, onChange, onClose }: { columns: Column<T>[]; visible: string[]; onChange: (keys: string[]) => void; onClose: () => void }) {
  return (
    <Modal title="Columns" size="sm" onClose={onClose}>
      <div className={styles.columnList}>
        {columns.map((c) => (
          <label key={c.key} className={styles.check}>
            <input
              type="checkbox"
              checked={visible.includes(c.key)}
              disabled={c.fixed}
              onChange={(e) => onChange(e.target.checked ? columns.filter((x) => visible.includes(x.key) || x.key === c.key).map((x) => x.key) : visible.filter((k) => k !== c.key))}
            />
            {c.label}
          </label>
        ))}
      </div>
      <Row justify="end">
        <Button onClick={onClose}>Done</Button>
      </Row>
    </Modal>
  );
}

export interface RegisterProps<T extends { id: string }> {
  collection: Collection;
  fields: FieldDef<T>[];
  columns: Column<T>[];
  load: (q: { filters: ViewFilter[]; search: string; sort?: ViewSort }) => Promise<T[]>;
  hrefFor: (row: T) => string;
  noun: [string, string];
  exportFile: string;
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  card: (row: T, l: Lookups) => ReactNode;
}

const PAGE = 50;

export function Register<T extends { id: string }>({ collection, fields, columns, load, hrefFor, noun, exportFile, bulkActions, card }: RegisterProps<T>) {
  const { search: params } = useLocation();
  const l = useLookups();
  const { me, can } = useMe();
  const toast = useToast();
  const views = useQuery((r) => r.views(collection), [collection]);
  const viewId = params.get('view') ?? views.data?.[0]?.id ?? '';
  const view = views.data?.find((v) => v.id === viewId) ?? views.data?.[0];

  const defaults = columns.filter((c) => c.defaultVisible !== false).map((c) => c.key);
  const [filters, setFilters] = useState<ViewFilter[]>([]);
  const [sort, setSort] = useState<ViewSort | undefined>();
  const [visible, setVisible] = useState<string[]>(defaults);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [dialog, setDialog] = useState<'filter' | 'columns' | 'save' | null>(null);
  const [viewName, setViewName] = useState('');

  // Load the view's settings whenever another view is chosen.
  useEffect(() => {
    if (!view) return;
    setFilters(view.filters);
    setSort(view.sort);
    setVisible(view.columns ?? defaults);
    setSelected(new Set());
    setLimit(PAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.id]);

  const rows = useQuery(() => load({ filters, search, sort }), [JSON.stringify(filters), search, JSON.stringify(sort)]);
  const all = useQuery(() => load({ filters: [], search: '' }), []);
  const list = rows.data ?? [];
  const shown = list.slice(0, limit);
  const shownColumns = columns.filter((c) => visible.includes(c.key));

  const dirty = !!view && (JSON.stringify(view.filters) !== JSON.stringify(filters) || JSON.stringify(view.sort ?? null) !== JSON.stringify(sort ?? null) || JSON.stringify(view.columns ?? defaults) !== JSON.stringify(visible));

  function toggleSort(key: string) {
    setSort((s) => (s?.field !== key ? { field: key, dir: 'asc' } : s.dir === 'asc' ? { field: key, dir: 'desc' } : undefined));
  }

  function chooseView(v: SavedView) {
    navigate(`${window.location.pathname}?view=${v.id}`, { replace: true });
  }

  async function saveAsNew() {
    if (!me || !viewName.trim()) return;
    const saved = await repo().saveView({ collection, name: viewName.trim(), filters, sort, columns: visible, createdBy: me.id }, me.id);
    setDialog(null);
    setViewName('');
    toast.push(`Saved the view "${saved.name}" for everyone in the workspace`);
    chooseView(saved);
  }

  async function updateView() {
    if (!me || !view || view.builtIn) return;
    await repo().saveView({ ...view, filters, sort, columns: visible }, me.id);
    toast.push(`Updated "${view.name}"`);
  }

  function exportCsv(items: T[]) {
    const header = columns.map((c) => c.label);
    const body = items.map((row) => columns.map((c) => {
      const f = fields.find((x) => x.key === (c.sortKey ?? c.key));
      return f ? (f.display ? f.display(row, l) : f.get(row, l) ?? '') : '';
    }));
    downloadCsv([header, ...body], exportFile);
    toast.push(`Exported ${items.length} ${items.length === 1 ? noun[0] : noun[1]} to ${exportFile}`);
  }

  const allSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const selectedRows = list.filter((r) => selected.has(r.id));

  return (
    <div className={styles.register}>
      <div className={styles.tabs} role="tablist" aria-label="Saved views">
        {(views.data ?? []).map((v) => (
          <button key={v.id} type="button" role="tab" aria-selected={v.id === view?.id} className={styles.tab} onClick={() => chooseView(v)}>
            {v.name}
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input type="search" placeholder={`Search ${noun[1]}`} aria-label={`Search ${noun[1]}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={styles.tools}>
          <Button variant="secondary" size="sm" icon={<ListFilter size={15} />} onClick={() => setDialog('filter')}>
            Filter
          </Button>
          <Button variant="secondary" size="sm" icon={<Columns3 size={15} />} onClick={() => setDialog('columns')}>
            Columns
          </Button>
          {can('export') && (
            <Button variant="secondary" size="sm" icon={<Download size={15} />} onClick={() => exportCsv(list)}>
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {(filters.length > 0 || dirty) && (
        <div className={styles.chips}>
          {filters.map((f, i) => (
            <span key={`${f.field}-${i}`} className={styles.chip}>
              {describeFilter(f, fields, all.data ?? [], l)}
              <button type="button" aria-label={`Remove filter: ${describeFilter(f, fields, all.data ?? [], l)}`} onClick={() => setFilters(filters.filter((_, j) => j !== i))}>
                <X size={13} />
              </button>
            </span>
          ))}
          {dirty && can('views.save') && (
            <span className={styles.saveRow}>
              {!view?.builtIn && (
                <Button variant="ghost" size="sm" onClick={updateView}>
                  Update “{view?.name}”
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={<Save size={14} />} onClick={() => setDialog('save')}>
                Save as a new view
              </Button>
            </span>
          )}
        </div>
      )}

      <p className={styles.count} aria-live="polite">
        {rows.data ? `${list.length} ${list.length === 1 ? noun[0] : noun[1]}` : 'Loading…'}
        {search && ` matching “${search}”`}
      </p>

      {rows.data && list.length === 0 ? (
        <div className={styles.panel}>
          <EmptyState
            icon={<ListFilter size={28} />}
            title={`No ${noun[1]} match`}
            hint="Try a different search, or remove a filter."
            action={filters.length || search ? { label: 'Clear search and filters', onClick: () => { setFilters([]); setSearch(''); } } : undefined}
          />
        </div>
      ) : (
        <>
          <div className={`${styles.panel} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCell}>
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allSelected}
                      onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())}
                    />
                  </th>
                  {shownColumns.map((c) => {
                    const key = c.sortKey ?? c.key;
                    const active = sort?.field === key;
                    return (
                      <th key={c.key} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={c.align === 'right' ? styles.right : undefined}>
                        <button type="button" className={styles.sortButton} onClick={() => toggleSort(key)}>
                          {c.label}
                          {active && (sort!.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr
                    key={row.id}
                    className={selected.has(row.id) ? styles.selected : undefined}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input,button,a')) return;
                      navigate(hrefFor(row));
                    }}
                  >
                    <td className={styles.checkCell}>
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected.has(row.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    {shownColumns.map((c) => (
                      <td key={c.key} className={c.align === 'right' ? styles.right : undefined}>
                        {c.render(row, l)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={styles.cards}>
            {shown.map((row) => (
              <li key={row.id}>
                <a
                  href={hrefFor(row)}
                  className={styles.card}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(hrefFor(row));
                  }}
                >
                  {card(row, l)}
                </a>
              </li>
            ))}
          </ul>

          {list.length > shown.length && (
            <Row justify="center">
              <Button variant="secondary" icon={<Plus size={15} />} onClick={() => setLimit(limit + PAGE)}>
                Show {Math.min(PAGE, list.length - shown.length)} more of {list.length - shown.length}
              </Button>
            </Row>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className={styles.bulk} role="region" aria-label="Selected rows">
          <span>
            <strong>{selected.size}</strong> selected
          </span>
          {bulkActions?.(selectedRows, () => setSelected(new Set()))}
          {can('export') && (
            <Button variant="ghost" size="sm" onClick={() => exportCsv(selectedRows)}>
              Export selected
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {dialog === 'filter' && (
        <AddFilter
          fields={fields}
          rows={all.data ?? []}
          l={l}
          onClose={() => setDialog(null)}
          onAdd={(f) => {
            setFilters([...filters, f]);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'columns' && <ColumnsPicker columns={columns} visible={visible} onChange={setVisible} onClose={() => setDialog(null)} />}
      {dialog === 'save' && (
        <Modal title="Save as a new view" size="sm" onClose={() => setDialog(null)}>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              saveAsNew();
            }}
          >
            <TextField label="Name" value={viewName} onChange={(e) => setViewName(e.target.value)} hint="Everyone in the workspace will see this view." autoFocus required />
            <Row justify="end">
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!viewName.trim()}>
                Save view
              </Button>
            </Row>
          </Form>
        </Modal>
      )}
    </div>
  );
}
