import { useState } from 'react';
import { Button, Form, Row, SelectField, TextAreaField, TextField } from '../ui';
import { STATUS_LABEL, STATUS_ORDER } from '../data/fields';
import { useLookups, useQuery } from '../data/hooks';
import type { AssetInput } from '../data/repository';
import type { AssetStatus } from '../data/types';
import styles from './AssetForm.module.css';

export type AssetDraft = Pick<AssetInput, 'name' | 'category' | 'model' | 'serial' | 'siteId' | 'placeId' | 'status' | 'purchasedOn' | 'cost' | 'notes'>;

/** Add or edit an asset's details. Custody (who has it) is changed with
 *  check-out and check-in, not here, so the history stays meaningful. */
export function AssetForm({ initial, submitLabel, onSubmit, onCancel, busy }: { initial: AssetDraft; submitLabel: string; onSubmit: (draft: AssetDraft) => void; onCancel: () => void; busy?: boolean }) {
  const l = useLookups();
  const assets = useQuery((r) => r.assets(), []);
  const [d, setD] = useState<AssetDraft>(initial);
  const set = <K extends keyof AssetDraft>(key: K, value: AssetDraft[K]) => setD((x) => ({ ...x, [key]: value }));
  const categories = Array.from(new Set((assets.data ?? []).map((a) => a.category))).sort();
  const rooms = Array.from(l.places.values()).filter((p) => p.siteId === d.siteId);

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        if (!d.name.trim() || !d.category.trim() || !d.siteId) return;
        onSubmit({ ...d, name: d.name.trim(), category: d.category.trim() });
      }}
    >
      <div className={styles.grid}>
        <TextField label="Name" value={d.name} onChange={(e) => set('name', e.target.value)} required autoFocus />
        <div>
          <TextField label="Category" value={d.category} onChange={(e) => set('category', e.target.value)} list="tw-categories" required />
          <datalist id="tw-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <TextField label="Model" value={d.model ?? ''} onChange={(e) => set('model', e.target.value || undefined)} />
        <TextField label="Serial number" value={d.serial ?? ''} onChange={(e) => set('serial', e.target.value || undefined)} />
        <SelectField
          label="Site"
          value={d.siteId}
          onChange={(e) => setD((x) => ({ ...x, siteId: e.target.value, placeId: undefined }))}
          options={Array.from(l.sites.values()).map((s) => ({ value: s.id, label: s.name }))}
        />
        <SelectField
          label="Room or store"
          value={d.placeId ?? ''}
          onChange={(e) => set('placeId', e.target.value || undefined)}
          options={[{ value: '', label: 'Not set' }, ...rooms.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <SelectField
          label="Status"
          value={d.status}
          onChange={(e) => set('status', e.target.value as AssetStatus)}
          options={STATUS_ORDER.filter((s) => s !== 'checked_out' || d.status === 'checked_out').map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          hint={d.status === 'checked_out' ? 'Check it in to change this.' : undefined}
          disabled={d.status === 'checked_out'}
        />
        <TextField label="Purchased" type="date" value={d.purchasedOn ?? ''} onChange={(e) => set('purchasedOn', e.target.value || undefined)} />
        <TextField
          label="Cost (pula)"
          type="number"
          min={0}
          step={50}
          value={d.cost ?? ''}
          onChange={(e) => set('cost', e.target.value === '' ? undefined : Number(e.target.value))}
          hint="Illustrative: a register is not an accounting system."
        />
      </div>
      <TextAreaField label="Notes" value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value || undefined)} />
      <Row justify="end">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !d.name.trim() || !d.category.trim()}>
          {submitLabel}
        </Button>
      </Row>
    </Form>
  );
}
