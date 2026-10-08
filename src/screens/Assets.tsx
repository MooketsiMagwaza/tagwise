import { Plus, Tags } from 'lucide-react';
import { Button, ButtonLink } from '../ui';
import { navigate } from '../lib/router';
import { ASSET_FIELDS } from '../data/fields';
import { repo, useMe } from '../data/hooks';
import type { Asset } from '../data/types';
import { money } from '../lib/format';
import { PersonChip, ScreenHeader, StatusPill } from '../app/bits';
import { Register, type Column } from '../app/register/Register';
import { Ago, Code, Due, Muted, Primary, RowCard } from '../app/register/cells';

const COLUMNS: Column<Asset>[] = [
  { key: 'tag', label: 'Tag', fixed: true, render: (a) => <Code>{a.tag}</Code> },
  { key: 'name', label: 'Name', fixed: true, render: (a) => <Primary title={a.name} detail={a.serial} /> },
  { key: 'category', label: 'Category', render: (a) => a.category },
  { key: 'status', label: 'Status', render: (a) => <StatusPill status={a.status} size="sm" /> },
  { key: 'siteId', label: 'Site', render: (a, l) => l.sites.get(a.siteId)?.name },
  { key: 'placeId', label: 'Room or store', render: (a, l) => (a.placeId ? l.places.get(a.placeId)?.name : <Muted>–</Muted>) },
  { key: 'custodianId', label: 'Custodian', render: (a, l) => (a.custodianId ? <PersonChip person={l.people.get(a.custodianId)} /> : <Muted>–</Muted>) },
  { key: 'dueBack', label: 'Due back', render: (a) => <Due date={a.dueBack} /> },
  { key: 'cost', label: 'Cost', align: 'right', defaultVisible: false, render: (a) => money(a.cost) },
  { key: 'purchasedOn', label: 'Purchased', defaultVisible: false, render: (a) => a.purchasedOn },
  { key: 'updatedAt', label: 'Updated', render: (a) => <Ago iso={a.updatedAt} /> },
];

export default function Assets() {
  const { can } = useMe();
  return (
    <>
      <ScreenHeader
        title="Assets"
        subtitle="Everything with a tag: who has it, where it is, and what state it is in."
        actions={
          <>
            {can('import') && (
              <ButtonLink href="/app/import" variant="secondary">
                Import
              </ButtonLink>
            )}
            {can('asset.create') && (
              <ButtonLink href="/app/assets/new" icon={<Plus size={16} />}>
                Add asset
              </ButtonLink>
            )}
          </>
        }
      />
      <Register<Asset>
        collection="assets"
        fields={ASSET_FIELDS}
        columns={COLUMNS}
        load={(q) => repo().assets(q)}
        hrefFor={(a) => `/app/assets/${a.tag}`}
        noun={['asset', 'assets']}
        exportFile="tagwise-assets.csv"
        card={(a, l) => (
          <RowCard
            code={a.tag}
            title={a.name}
            trailing={<StatusPill status={a.status} size="sm" />}
            meta={[l.sites.get(a.siteId)?.name, a.placeId && l.places.get(a.placeId)?.name, a.custodianId && l.people.get(a.custodianId)?.name].filter(Boolean).join(' · ')}
          />
        )}
        bulkActions={(rows) =>
          can('labels.print') ? (
            <Button variant="primary" size="sm" icon={<Tags size={14} />} onClick={() => navigate(`/app/labels?ids=${rows.map((r) => r.tag).join(',')}`)}>
              Print labels
            </Button>
          ) : null
        }
      />
    </>
  );
}
