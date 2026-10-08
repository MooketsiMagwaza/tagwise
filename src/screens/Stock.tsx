import { ButtonLink } from '../ui';
import { STOCK_FIELDS } from '../data/fields';
import { repo, useMe } from '../data/hooks';
import type { StockItem } from '../data/types';
import { ScreenHeader } from '../app/bits';
import { Register, type Column } from '../app/register/Register';
import { Ago, Code, Expiry, Muted, Primary, Quantity, RowCard } from '../app/register/cells';

const COLUMNS: Column<StockItem>[] = [
  { key: 'sku', label: 'SKU', fixed: true, render: (k) => <Code>{k.sku}</Code> },
  { key: 'name', label: 'Name', fixed: true, render: (k) => <Primary title={k.name} detail={k.category} /> },
  { key: 'siteId', label: 'Site', render: (k, l) => l.sites.get(k.siteId)?.name },
  { key: 'quantity', label: 'On hand', align: 'right', render: (k) => <Quantity qty={k.quantity} reorderAt={k.reorderAt} unit={k.unit} /> },
  { key: 'reorderAt', label: 'Reorder at', align: 'right', render: (k) => k.reorderAt },
  { key: 'expiresOn', label: 'Expires', render: (k) => <Expiry date={k.expiresOn} /> },
  { key: 'batch', label: 'Batch', defaultVisible: false, render: (k) => k.batch ?? <Muted>–</Muted> },
  { key: 'barcode', label: 'Barcode', render: (k) => <Code>{k.barcode}</Code> },
  { key: 'updatedAt', label: 'Updated', render: (k) => <Ago iso={k.updatedAt} /> },
];

export default function Stock() {
  const { can } = useMe();
  return (
    <>
      <ScreenHeader
        title="Stock"
        subtitle="Consumables counted by quantity: paper, toner, gloves, chalk. Scan a barcode to receive or issue."
        actions={
          <>
            {can('import') && (
              <ButtonLink href="/app/import?to=stock" variant="secondary">
                Import
              </ButtonLink>
            )}
            <ButtonLink href="/app/scan">Scan a barcode</ButtonLink>
          </>
        }
      />
      <Register<StockItem>
        collection="stock"
        fields={STOCK_FIELDS}
        columns={COLUMNS}
        load={(q) => repo().stock(q)}
        hrefFor={(k) => `/app/stock/${k.id}`}
        noun={['stock line', 'stock lines']}
        exportFile="tagwise-stock.csv"
        card={(k, l) => (
          <RowCard
            code={k.sku}
            title={k.name}
            trailing={<Quantity qty={k.quantity} reorderAt={k.reorderAt} />}
            meta={`${l.sites.get(k.siteId)?.name ?? ''} · ${k.unit}`}
          />
        )}
      />
    </>
  );
}
