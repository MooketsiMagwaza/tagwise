import { SearchX } from 'lucide-react';
import { ButtonLink, Card, CardHeader, EmptyState, Text } from '../ui';
import { Link, navigate } from '../lib/router';
import { useLookups, useQuery } from '../data/hooks';
import { KeyValue, ScreenHeader, StatusPill } from '../app/bits';
import { SiteMap } from '../app/map/SiteMap';
import { KIND } from './Sites';
import styles from './Detail.module.css';

export default function SiteDetail({ params }: { params: Record<string, string> }) {
  const l = useLookups();
  const assets = useQuery((r) => r.assets({ filters: [{ field: 'siteId', op: 'is', value: params.id }] }), [params.id]);
  const stock = useQuery((r) => r.stock({ filters: [{ field: 'siteId', op: 'is', value: params.id }] }), [params.id]);
  const site = l.sites.get(params.id);
  if (!l.ready) return null;
  if (!site) {
    return (
      <Card>
        <EmptyState icon={<SearchX size={28} />} title="No such site" action={{ label: 'All sites', onClick: () => navigate('/app/sites') }} />
      </Card>
    );
  }
  const rooms = Array.from(l.places.values()).filter((p) => p.siteId === site.id);
  const here = assets.data ?? [];
  const attention = here.filter((a) => a.status === 'in_repair' || a.status === 'missing' || a.status === 'checked_out');

  return (
    <div className={styles.page}>
      <ScreenHeader
        eyebrow={
          <>
            <Link href="/app/sites">Sites</Link> / <span>{site.code}</span>
          </>
        }
        title={site.name}
        subtitle={`${KIND[site.kind].label} · ${site.address}`}
        actions={
          <>
            <ButtonLink href={`/app/stock?site=${site.id}`} variant="secondary">
              Stock here
            </ButtonLink>
            <ButtonLink href={`/app/assets?site=${site.id}`}>Assets here</ButtonLink>
          </>
        }
      />
      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Card padding="none">
            <div className={styles.roomsHead}>
              <CardHeader title="Rooms and stores" meta={`${rooms.length} rooms`} />
            </div>
            <table className={styles.roomsTable}>
              <thead>
                <tr>
                  <th scope="col">Room</th>
                  <th scope="col">Assets</th>
                  <th scope="col">Stock lines</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.name}</th>
                    <td>{here.filter((a) => a.placeId === p.id).length}</td>
                    <td>{(stock.data ?? []).filter((k) => k.placeId === p.id).length || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card>
            <CardHeader title="Out, in repair or missing" meta={String(attention.length)} />
            {attention.length === 0 ? (
              <Text tone="secondary">Everything here is where it should be.</Text>
            ) : (
              <ul className={styles.plainList}>
                {attention.map((a) => (
                  <li key={a.id}>
                    <Link href={`/app/assets/${a.tag}`}>{a.name}</Link>
                    <span className={styles.mono}>{a.tag}</span>
                    <StatusPill status={a.status} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className={styles.sideCol}>
          <SiteMap sites={[site]} height="short" />
          <Card>
            <KeyValue
              items={[
                { label: 'Code', value: <span className={styles.mono}>{site.code}</span> },
                { label: 'Kind', value: KIND[site.kind].label },
                { label: 'Town', value: site.town },
                { label: 'Assets', value: String(here.length) },
                { label: 'Stock lines', value: String((stock.data ?? []).length) },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
