import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, Info, PackageMinus, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, Banner, ButtonLink, Card, CardHeader, Text } from '../ui';
import { Link } from '../lib/router';
import { useLookups, useMe, useQuery } from '../data/hooks';
import { count, daysUntil, dueLabel, relativeTime } from '../lib/format';
import { Progress, ScreenHeader } from '../app/bits';
import { ActivityLine } from '../app/ActivityLine';
import styles from './Dashboard.module.css';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function Attention({ icon, tone, title, detail, href }: { icon: ReactNode; tone: 'danger' | 'warning' | 'brand' | 'accent'; title: string; detail: string; href: string }) {
  return (
    <li>
      <Link href={href} className={styles.attention}>
        <span className={`${styles.attIcon} ${styles[tone]}`}>{icon}</span>
        <span className={styles.attText}>
          <span className={styles.attTitle}>{title}</span>
          <span className={styles.attDetail}>{detail}</span>
        </span>
        <ArrowRight size={16} className={styles.attArrow} aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function Dashboard() {
  const { me } = useMe();
  const l = useLookups();
  const assets = useQuery((r) => r.assets(), []);
  const stock = useQuery((r) => r.stock(), []);
  const counts = useQuery((r) => r.counts(), []);
  const activity = useQuery((r) => r.activity({ limit: 8 }), []);
  const open = counts.data?.find((c) => c.status === 'open');
  const openDetail = useQuery((r) => (open ? r.count(open.id) : Promise.resolve(null)), [open?.id]);

  const all = assets.data ?? [];
  const overdue = all.filter((a) => a.status === 'checked_out' && (daysUntil(a.dueBack) ?? 1) < 0);
  const dueSoon = all.filter((a) => a.status === 'checked_out' && (daysUntil(a.dueBack) ?? 99) >= 0 && (daysUntil(a.dueBack) ?? 99) <= 3);
  const repair = all.filter((a) => a.status === 'in_repair');
  const missing = all.filter((a) => a.status === 'missing');
  const low = (stock.data ?? []).filter((k) => k.quantity <= k.reorderAt);
  const expiring = (stock.data ?? []).filter((k) => (daysUntil(k.expiresOn) ?? 999) <= 60);

  const found = new Set((openDetail.data?.scans ?? []).filter((s) => s.result === 'found' || s.result === 'wrong_place').map((s) => s.assetId));
  const counters = Array.from(new Set((openDetail.data?.scans ?? []).map((s) => s.by)));

  const bySite = Array.from(l.sites.values()).map((s) => ({
    site: s,
    total: all.filter((a) => a.siteId === s.id && a.status !== 'retired').length,
    out: all.filter((a) => a.siteId === s.id && a.status === 'checked_out').length,
    low: (stock.data ?? []).filter((k) => k.siteId === s.id && k.quantity <= k.reorderAt).length,
  }));

  const firstName = me?.name.split(' ')[0] ?? '';

  return (
    <div className={styles.page}>
      <Banner tone="brand" icon={<Info size={16} aria-hidden="true" />}>
        Sample workspace: the trust, the people and every figure are invented. Changes stay in this browser.
      </Banner>
      <ScreenHeader
        title={`${greeting()}, ${firstName}`}
        subtitle={`${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · ${count(all.length, 'asset')} across ${count(l.sites.size, 'site')}`}
        actions={
          <>
            <ButtonLink href="/app/assets" variant="secondary">
              Open the register
            </ButtonLink>
          </>
        }
      />

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <Card>
            <CardHeader title="Needs attention" meta={assets.data ? 'Updated live' : 'Loading'} />
            <ul className={styles.attList}>
              {overdue.length > 0 && (
                <Attention
                  icon={<CalendarClock size={18} />}
                  tone="danger"
                  title={`${count(overdue.length, 'item')} overdue`}
                  detail={overdue
                    .slice(0, 2)
                    .map((a) => `${a.name} with ${l.people.get(a.custodianId ?? '')?.name ?? 'someone'}, ${dueLabel(a.dueBack)}`)
                    .join('; ')}
                  href="/app/assets?view=v-out"
                />
              )}
              {dueSoon.length > 0 && (
                <Attention
                  icon={<CalendarClock size={18} />}
                  tone="warning"
                  title={`${count(dueSoon.length, 'item')} due back in the next three days`}
                  detail="Checked out to staff; a reminder is not sent in the prototype."
                  href="/app/assets?view=v-out"
                />
              )}
              {low.length > 0 && (
                <Attention
                  icon={<PackageMinus size={18} />}
                  tone="warning"
                  title={`${count(low.length, 'stock line')} at or below reorder level`}
                  detail={Array.from(new Map(low.map((k) => [k.name, k])).values())
                    .slice(0, 3)
                    .map((k) => `${k.name} (${k.quantity} left)`)
                    .join(', ')}
                  href="/app/stock?view=v-stock-low"
                />
              )}
              {expiring.length > 0 && (
                <Attention
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                  title={`${count(expiring.length, 'batch', 'batches')} expiring within 60 days`}
                  detail="Clinical consumables first. Check the batch before issuing."
                  href="/app/stock?view=v-stock-exp"
                />
              )}
              {repair.length + missing.length > 0 && (
                <Attention
                  icon={<Wrench size={18} />}
                  tone="accent"
                  title={`${count(repair.length, 'asset')} in repair, ${missing.length} missing`}
                  detail="Missing items were not found at the last count."
                  href="/app/assets?view=v-attention"
                />
              )}
            </ul>
          </Card>

          {open && (
            <Card>
              <div className={styles.countHead}>
                <span className={styles.countIcon}>
                  <ClipboardCheck size={20} />
                </span>
                <div className={styles.countText}>
                  <Text variant="caption" tone="secondary">
                    Stock-take in progress · {l.sites.get(open.siteId)?.name} · started {relativeTime(open.startedAt)}
                  </Text>
                  <Text as="h2" variant="headline">
                    {open.name}
                  </Text>
                </div>
                <ButtonLink href={`/app/counts/${open.id}`} variant="secondary" size="sm">
                  Open the board
                </ButtonLink>
              </div>
              <div className={styles.countBody}>
                <Progress value={found.size} max={open.expected.length} label="Assets found" tone="accent" />
                <div className={styles.countMeta}>
                  <Text variant="small">
                    <strong>{found.size}</strong> of {open.expected.length} found
                  </Text>
                  <span className={styles.counters}>
                    {counters.map((id) => {
                      const p = l.people.get(id);
                      return p ? <Avatar key={id} initials={p.initials} hue={p.hue} size="sm" label={`${p.name} is counting`} /> : null;
                    })}
                  </span>
                </div>
              </div>
            </Card>
          )}

          <Card padding="none">
            <div className={styles.sitesHead}>
              <CardHeader title="By site" action={<Link href="/app/sites">Map</Link>} />
            </div>
            <table className={styles.sites}>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Assets</th>
                  <th scope="col">Checked out</th>
                  <th scope="col">Low stock</th>
                </tr>
              </thead>
              <tbody>
                {bySite.map((row) => (
                  <tr key={row.site.id}>
                    <th scope="row">
                      <Link href={`/app/sites/${row.site.id}`}>{row.site.name}</Link>
                      <span className={styles.town}>{row.site.town}</span>
                    </th>
                    <td>{row.total}</td>
                    <td>{row.out || '–'}</td>
                    <td>{row.low ? <span className={styles.lowNum}>{row.low}</span> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <Card>
          <CardHeader title="Recent activity" action={<Link href="/app/activity">See all</Link>} />
          <ol className={styles.feed}>
            {(activity.data ?? []).map((a) => (
              <ActivityLine key={a.id} activity={a} people={l.people} compact />
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
