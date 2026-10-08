// The sample workspace: a fictional community trust with offices, a store,
// a school and clinics in Botswana. Every person, tag, serial number and
// figure here is invented. The generator is seeded, so every visitor gets
// the same register; dates are placed relative to the moment of seeding so
// "due back tomorrow" stays true on the day you open it.

import type {
  Activity,
  Asset,
  AssetStatus,
  Comment,
  CountScan,
  CountSession,
  Db,
  Person,
  Place,
  SavedView,
  Site,
  StockItem,
} from './types';

export const SCHEMA = 1;

/** mulberry32: a tiny deterministic PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

const DAY = 86_400_000;

export const SAMPLE_PEOPLE: Person[] = [
  { id: 'p-kagiso', name: 'Kagiso Molefe', initials: 'KM', team: 'Operations', hue: '#1d5bb8', role: 'owner', email: 'kagiso@morula.example' },
  { id: 'p-naledi', name: 'Naledi Sebego', initials: 'NS', team: 'Finance and assets', hue: '#c2620a', role: 'admin', email: 'naledi@morula.example' },
  { id: 'p-tumelo', name: 'Tumelo Kgosi', initials: 'TK', team: 'IT', hue: '#0e6f73', role: 'editor', email: 'tumelo@morula.example' },
  { id: 'p-boitumelo', name: 'Boitumelo Ramotswa', initials: 'BR', team: 'Clinics', hue: '#b42356', role: 'editor', email: 'boitumelo@morula.example' },
  { id: 'p-lesego', name: 'Lesego Phiri', initials: 'LP', team: 'Internal audit', hue: '#5b6b00', role: 'auditor', email: 'lesego@morula.example' },
  { id: 'p-onalenna', name: 'Onalenna Dube', initials: 'OD', team: 'Mochudi learning centre', hue: '#7a4b00', role: 'viewer', email: 'onalenna@morula.example' },
  { id: 'p-neo', name: 'Neo Modise', initials: 'NM', team: 'Mochudi learning centre', hue: '#1d5bb8' },
  { id: 'p-thato', name: 'Thato Kenosi', initials: 'TK', team: 'Mochudi learning centre', hue: '#c2620a' },
  { id: 'p-refilwe', name: 'Refilwe Mosweu', initials: 'RM', team: 'Molepolole clinic', hue: '#0e6f73' },
  { id: 'p-gaone', name: 'Gaone Tau', initials: 'GT', team: 'Molepolole clinic', hue: '#b42356' },
  { id: 'p-kelebogile', name: 'Kelebogile Moeng', initials: 'KM', team: 'Maun clinic', hue: '#5b6b00' },
  { id: 'p-oratile', name: 'Oratile Nkwe', initials: 'ON', team: 'Francistown office', hue: '#7a4b00' },
  { id: 'p-lorato', name: 'Lorato Gabaake', initials: 'LG', team: 'Head office', hue: '#1d5bb8' },
  { id: 'p-kabelo', name: 'Kabelo Motsumi', initials: 'KM', team: 'Drivers', hue: '#c2620a' },
  { id: 'p-dineo', name: 'Dineo Tshekiso', initials: 'DT', team: 'Head office', hue: '#0e6f73' },
  { id: 'p-masego', name: 'Masego Pule', initials: 'MP', team: 'Central store', hue: '#b42356' },
];

export const SAMPLE_SITES: Site[] = [
  { id: 's-hq', code: 'HQ', name: 'Head office', kind: 'office', town: 'Gaborone', address: 'Main Mall area, Gaborone', lat: -24.6558, lng: 25.9086 },
  { id: 's-store', code: 'CS', name: 'Central store', kind: 'warehouse', town: 'Gaborone', address: 'Broadhurst Industrial, Gaborone', lat: -24.6297, lng: 25.9378 },
  { id: 's-mochudi', code: 'MO', name: 'Mochudi learning centre', kind: 'school', town: 'Mochudi', address: 'Mochudi, Kgatleng', lat: -24.3833, lng: 26.15 },
  { id: 's-molepolole', code: 'ML', name: 'Molepolole clinic', kind: 'clinic', town: 'Molepolole', address: 'Molepolole, Kweneng', lat: -24.4066, lng: 25.4951 },
  { id: 's-francistown', code: 'FT', name: 'Francistown office', kind: 'office', town: 'Francistown', address: 'Francistown, North-East', lat: -21.17, lng: 27.5079 },
  { id: 's-maun', code: 'MA', name: 'Maun clinic', kind: 'clinic', town: 'Maun', address: 'Maun, North-West', lat: -19.9833, lng: 23.4167 },
];

const PLACE_NAMES: Record<string, string[]> = {
  's-hq': ['Reception', 'Finance office', 'Boardroom', 'IT room', 'Open-plan floor'],
  's-store': ['Bay A', 'Bay B', 'Cold room', 'Dispatch'],
  's-mochudi': ['Classroom 1', 'Classroom 2', 'Science lab', 'Library', 'Staff room'],
  's-molepolole': ['Consulting room 1', 'Consulting room 2', 'Pharmacy store', 'Vaccine room', 'Reception'],
  's-francistown': ['Main office', 'Store room'],
  's-maun': ['Consulting room', 'Pharmacy store', 'Reception'],
};

interface Template {
  category: string;
  models: string[];
  cost: [number, number];
  /** Which kinds of site keep this, and how many per site of that kind. */
  per: Partial<Record<Site['kind'], number>>;
  /** Preferred rooms, matched by substring. */
  rooms?: string[];
  serialPrefix: string;
}

const TEMPLATES: Template[] = [
  { category: 'Laptop', models: ['Dell Latitude 5440', 'Lenovo ThinkPad E14', 'HP ProBook 450 G10'], cost: [11500, 17800], per: { office: 9, school: 6, clinic: 2, warehouse: 1 }, serialPrefix: 'LT' },
  { category: 'Desktop', models: ['HP ProDesk 400 G9', 'Dell OptiPlex 7010'], cost: [9800, 13200], per: { office: 4, clinic: 2, warehouse: 1 }, rooms: ['Finance', 'Reception', 'Main office'], serialPrefix: 'DT' },
  { category: 'Monitor', models: ['Dell P2422H', 'HP E24 G5'], cost: [2400, 3600], per: { office: 6, clinic: 1 }, serialPrefix: 'MN' },
  { category: 'Projector', models: ['Epson EB-X49', 'BenQ MS560'], cost: [6900, 9400], per: { school: 3, office: 1 }, rooms: ['Classroom', 'Boardroom', 'Science'], serialPrefix: 'PJ' },
  { category: 'Printer', models: ['HP LaserJet Pro M404dn', 'Brother HL-L2350DW'], cost: [3100, 5200], per: { office: 2, school: 1, clinic: 1, warehouse: 1 }, rooms: ['Reception', 'Staff', 'Main office', 'Dispatch'], serialPrefix: 'PR' },
  { category: 'Tablet', models: ['Samsung Galaxy Tab A9', 'Lenovo Tab M10'], cost: [2800, 3900], per: { school: 8, clinic: 2 }, rooms: ['Library', 'Classroom'], serialPrefix: 'TB' },
  { category: 'Phone', models: ['Samsung Galaxy A15', 'Nokia G42'], cost: [2100, 3200], per: { office: 2, clinic: 1, warehouse: 1 }, serialPrefix: 'PH' },
  { category: 'Network', models: ['Ubiquiti UniFi U6 Lite', 'TP-Link 24-port switch', 'MikroTik hEX router'], cost: [1300, 4800], per: { office: 2, school: 1, clinic: 1 }, rooms: ['IT room', 'Staff', 'Reception', 'Main office'], serialPrefix: 'NW' },
  { category: 'Furniture', models: ['Office chair, mesh', 'Desk 1400 mm', 'Steel filing cabinet'], cost: [1100, 3400], per: { office: 3, school: 2 }, serialPrefix: 'FN' },
  { category: 'Medical equipment', models: ['Blood pressure monitor', 'Digital scale', 'Pulse oximeter', 'Examination couch'], cost: [900, 7600], per: { clinic: 5 }, rooms: ['Consulting'], serialPrefix: 'MD' },
  { category: 'Cold chain', models: ['Solar vaccine fridge', 'Vaccine carrier'], cost: [4200, 38000], per: { clinic: 1, warehouse: 1 }, rooms: ['Vaccine', 'Cold room', 'Pharmacy'], serialPrefix: 'CC' },
  { category: 'Science kit', models: ['Microscope, 40-1000x', 'Electricity kit', 'Digital balance'], cost: [1500, 4300], per: { school: 3 }, rooms: ['Science lab'], serialPrefix: 'SC' },
  { category: 'Power', models: ['UPS 1500 VA', 'Generator 5 kVA'], cost: [2600, 21000], per: { office: 1, clinic: 1, warehouse: 1 }, rooms: ['IT room', 'Pharmacy', 'Dispatch', 'Store'], serialPrefix: 'PW' },
  { category: 'Vehicle', models: ['Toyota Hilux 2.4 GD-6', 'Toyota Quantum'], cost: [420000, 610000], per: { warehouse: 2, office: 0 }, rooms: ['Dispatch'], serialPrefix: 'VH' },
];

const STOCK: { name: string; sku: string; category: string; unit: string; sites: string[]; qty: [number, number]; reorder: number; expires?: number }[] = [
  { name: 'A4 paper, 80 gsm', sku: 'PAP-A4-80', category: 'Stationery', unit: 'ream', sites: ['s-store', 's-hq', 's-mochudi'], qty: [8, 140], reorder: 20 },
  { name: 'Toner, HP 59A', sku: 'TON-HP-59A', category: 'Printing', unit: 'cartridge', sites: ['s-store', 's-hq'], qty: [0, 9], reorder: 3 },
  { name: 'Toner, Brother TN-2421', sku: 'TON-BR-2421', category: 'Printing', unit: 'cartridge', sites: ['s-store'], qty: [1, 7], reorder: 2 },
  { name: 'Examination gloves, medium', sku: 'GLV-NIT-M', category: 'Clinical consumables', unit: 'box of 100', sites: ['s-store', 's-molepolole', 's-maun'], qty: [2, 60], reorder: 10, expires: 400 },
  { name: 'Examination gloves, large', sku: 'GLV-NIT-L', category: 'Clinical consumables', unit: 'box of 100', sites: ['s-store', 's-molepolole'], qty: [1, 40], reorder: 10, expires: 380 },
  { name: 'Syringes, 5 ml', sku: 'SYR-5ML', category: 'Clinical consumables', unit: 'box of 100', sites: ['s-store', 's-molepolole', 's-maun'], qty: [3, 30], reorder: 6, expires: 700 },
  { name: 'Alcohol swabs', sku: 'SWB-ALC', category: 'Clinical consumables', unit: 'box of 100', sites: ['s-molepolole', 's-maun'], qty: [4, 50], reorder: 10, expires: 45 },
  { name: 'Surgical masks', sku: 'MSK-SURG', category: 'Clinical consumables', unit: 'box of 50', sites: ['s-store', 's-molepolole'], qty: [5, 80], reorder: 15, expires: 520 },
  { name: 'Sharps container, 5 l', sku: 'SHP-5L', category: 'Clinical consumables', unit: 'each', sites: ['s-molepolole', 's-maun'], qty: [1, 14], reorder: 4 },
  { name: 'Glucose test strips', sku: 'GLU-STR-50', category: 'Clinical consumables', unit: 'box of 50', sites: ['s-molepolole', 's-maun'], qty: [0, 22], reorder: 5, expires: 28 },
  { name: 'Hand sanitiser, 500 ml', sku: 'SAN-500', category: 'Cleaning', unit: 'bottle', sites: ['s-store', 's-hq', 's-mochudi', 's-molepolole'], qty: [2, 48], reorder: 8, expires: 300 },
  { name: 'Detergent, 5 l', sku: 'DET-5L', category: 'Cleaning', unit: 'can', sites: ['s-store', 's-mochudi'], qty: [1, 18], reorder: 4 },
  { name: 'Bin bags, heavy duty', sku: 'BIN-HD-20', category: 'Cleaning', unit: 'roll of 20', sites: ['s-store', 's-hq'], qty: [3, 40], reorder: 8 },
  { name: 'Chalk, white', sku: 'CHK-WHT-100', category: 'Teaching', unit: 'box of 100', sites: ['s-mochudi'], qty: [2, 26], reorder: 6 },
  { name: 'Whiteboard markers', sku: 'MRK-WB-4', category: 'Teaching', unit: 'pack of 4', sites: ['s-mochudi', 's-hq'], qty: [0, 30], reorder: 8 },
  { name: 'Exercise books, A4', sku: 'EXB-A4-10', category: 'Teaching', unit: 'pack of 10', sites: ['s-mochudi', 's-store'], qty: [12, 220], reorder: 40 },
  { name: 'HDMI cable, 2 m', sku: 'CAB-HDMI-2', category: 'IT spares', unit: 'each', sites: ['s-store', 's-hq'], qty: [0, 16], reorder: 4 },
  { name: 'USB-C charger, 65 W', sku: 'CHG-USBC-65', category: 'IT spares', unit: 'each', sites: ['s-store', 's-hq'], qty: [1, 9], reorder: 3 },
  { name: 'Network cable, 3 m', sku: 'CAB-CAT6-3', category: 'IT spares', unit: 'each', sites: ['s-store'], qty: [6, 60], reorder: 10 },
  { name: 'AA batteries', sku: 'BAT-AA-4', category: 'General', unit: 'pack of 4', sites: ['s-store', 's-molepolole', 's-mochudi'], qty: [2, 36], reorder: 6, expires: 900 },
  { name: 'LED bulb, 9 W', sku: 'BLB-LED-9', category: 'General', unit: 'each', sites: ['s-store'], qty: [4, 50], reorder: 10 },
  { name: 'Envelopes, DL', sku: 'ENV-DL-500', category: 'Stationery', unit: 'box of 500', sites: ['s-hq', 's-francistown'], qty: [0, 6], reorder: 2 },
  { name: 'Pens, blue', sku: 'PEN-BLU-50', category: 'Stationery', unit: 'box of 50', sites: ['s-hq', 's-mochudi', 's-francistown'], qty: [1, 20], reorder: 4 },
];

const COMMENTS: string[] = [
  'Screen has a hairline crack in the bottom-left corner. Still usable for now.',
  'Battery only lasts about an hour. Can we order a replacement?',
  'Moved here for the term; it goes back to the store in December.',
  'Fan is loud when it starts up. Logged with the supplier.',
  'Checked the seal and the temperature log; both fine this week.',
  'The label was peeling, so I printed a new one and stuck it on the underside.',
  'Remote is missing. Using the buttons on the unit for now.',
  'Warranty runs to the end of next year. Invoice is in the finance folder.',
  'Please bring it back to IT before the audit on Friday.',
  'Found it in the boardroom cupboard during the walk-round.',
];

export function createSeed(now: Date = new Date()): Db {
  const rand = prng(20261007);
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const iso = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();
  const day = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * DAY).toISOString().slice(0, 10);

  const people = SAMPLE_PEOPLE.map((p) => ({ ...p, lastActiveAt: p.role ? iso(between(0.02, 3) * DAY) : undefined }));
  const members = people.filter((p) => p.role);
  const sites = SAMPLE_SITES;

  const places: Place[] = [];
  for (const site of sites) {
    PLACE_NAMES[site.id].forEach((name, i) => places.push({ id: `${site.id}-r${i + 1}`, siteId: site.id, name }));
  }
  const placesOf = (siteId: string) => places.filter((p) => p.siteId === siteId);
  const peopleAt = (site: Site) =>
    people.filter((p) => p.team.includes(site.name) || (site.id === 's-hq' && ['Operations', 'Finance and assets', 'IT', 'Head office'].includes(p.team)));

  // ── assets ──────────────────────────────────────────────────────────
  const assets: Asset[] = [];
  let n = 0;
  for (const site of sites) {
    for (const t of TEMPLATES) {
      const count = t.per[site.kind] ?? 0;
      for (let i = 0; i < count; i++) {
        n += 1;
        const rooms = placesOf(site.id);
        const preferred = t.rooms ? rooms.filter((r) => t.rooms!.some((w) => r.name.includes(w))) : [];
        const place = preferred.length ? pick(preferred) : pick(rooms);
        const model = pick(t.models);
        const purchasedDaysAgo = Math.round(between(60, 1800));
        const roll = rand();
        let status: AssetStatus = 'in_use';
        if (roll > 0.62) status = 'available';
        if (roll > 0.8) status = 'checked_out';
        if (roll > 0.9) status = 'in_repair';
        if (roll > 0.95) status = 'missing';
        if (roll > 0.975) status = 'retired';
        if (t.category === 'Vehicle') status = roll > 0.5 ? 'checked_out' : 'available';
        if (n % 29 === 0) status = 'missing';
        const locals = peopleAt(site);
        const custodian =
          status === 'checked_out' || (status === 'in_use' && ['Laptop', 'Phone', 'Tablet'].includes(t.category))
            ? pick(locals.length ? locals : people)
            : undefined;
        const updatedAgo = between(0.05, 40) * DAY;
        const tag = `MCT-${String(n).padStart(5, '0')}`;
        assets.push({
          id: `a-${n}`,
          tag,
          name: model,
          category: t.category,
          model,
          serial: `${t.serialPrefix}${Math.floor(between(100000, 999999))}`,
          siteId: site.id,
          placeId: place?.id,
          status,
          custodianId: custodian?.id,
          dueBack: status === 'checked_out' ? day(Math.round(between(-6, 21))) : undefined,
          purchasedOn: day(-purchasedDaysAgo),
          cost: Math.round(between(t.cost[0], t.cost[1]) / 50) * 50,
          notes: status === 'in_repair' ? 'With the supplier for repair.' : status === 'missing' ? 'Not found at the last count.' : undefined,
          createdAt: iso(between(45, 60) * DAY),
          updatedAt: iso(updatedAgo),
          updatedBy: pick(members).id,
          version: 1 + Math.floor(rand() * 4),
        });
      }
    }
  }

  // ── stock ───────────────────────────────────────────────────────────
  const stock: StockItem[] = [];
  let s = 0;
  for (const item of STOCK) {
    for (const siteId of item.sites) {
      s += 1;
      const first12 = `20${String(1000000000 + s * 7919 + Math.floor(rand() * 1000)).slice(-10)}`;
      const rooms = placesOf(siteId);
      const store = rooms.find((r) => /store|Bay|Pharmacy|Staff|Store room/.test(r.name)) ?? rooms[0];
      const qty = Math.round(between(item.qty[0], item.qty[1]));
      stock.push({
        id: `k-${s}`,
        sku: item.sku,
        barcode: `${first12}${ean13CheckDigit(first12)}`,
        name: item.name,
        category: item.category,
        unit: item.unit,
        siteId,
        placeId: store?.id,
        quantity: qty,
        reorderAt: item.reorder,
        batch: item.expires ? `B${Math.floor(between(2400, 2699))}` : undefined,
        expiresOn: item.expires ? day(Math.round(between(item.expires * 0.4, item.expires))) : undefined,
        updatedAt: iso(between(0.1, 20) * DAY),
        updatedBy: pick(members).id,
        version: 1,
      });
    }
  }

  // ── comments ────────────────────────────────────────────────────────
  const comments: Comment[] = [];
  for (let i = 0; i < 26; i++) {
    const a = pick(assets);
    comments.push({
      id: `c-${i + 1}`,
      targetType: 'asset',
      targetId: a.id,
      authorId: pick(members).id,
      body: pick(COMMENTS),
      createdAt: iso(between(0.1, 30) * DAY),
    });
  }

  // ── activity ────────────────────────────────────────────────────────
  const activity: Activity[] = [];
  let ai = 0;
  const log = (a: Omit<Activity, 'id'>) => activity.push({ id: `e-${++ai}`, ...a });
  const label = (a: Asset) => `${a.tag} ${a.name}`;
  const nameOf = (id?: string) => people.find((p) => p.id === id)?.name ?? 'someone';

  log({ at: iso(58 * DAY), actorId: 'p-naledi', kind: 'imported', targetType: 'workspace', summary: `Imported ${assets.length} assets from asset-register-2026.xlsx` });
  log({ at: iso(57.9 * DAY), actorId: 'p-naledi', kind: 'imported', targetType: 'workspace', summary: `Imported ${stock.length} stock lines from stores-count-june.csv` });
  for (const a of assets) {
    if (a.status === 'checked_out' && a.custodianId) {
      log({ at: iso(between(1, 14) * DAY), actorId: pick(members).id, kind: 'checked_out', targetType: 'asset', targetId: a.id, targetLabel: label(a), summary: `Checked out to ${nameOf(a.custodianId)}, due back ${a.dueBack}` });
    }
    if (a.status === 'in_repair') {
      log({ at: iso(between(1, 20) * DAY), actorId: 'p-tumelo', kind: 'updated', targetType: 'asset', targetId: a.id, targetLabel: label(a), summary: 'Status changed', changes: [{ field: 'Status', from: 'In use', to: 'In repair' }] });
    }
    if (a.status === 'missing') {
      log({ at: iso(between(18, 22) * DAY), actorId: 'p-lesego', kind: 'updated', targetType: 'asset', targetId: a.id, targetLabel: label(a), summary: 'Marked missing after the count', changes: [{ field: 'Status', from: 'In use', to: 'Missing' }] });
    }
  }
  for (let i = 0; i < 22; i++) {
    const a = pick(assets);
    const room = pick(placesOf(a.siteId));
    log({ at: iso(between(0.1, 35) * DAY), actorId: pick(members).id, kind: 'moved', targetType: 'asset', targetId: a.id, targetLabel: label(a), summary: `Moved to ${room.name}` });
  }
  for (let i = 0; i < 12; i++) {
    const a = pick(assets);
    log({ at: iso(between(0.2, 30) * DAY), actorId: pick(members).id, kind: 'returned', targetType: 'asset', targetId: a.id, targetLabel: label(a), summary: `Returned by ${nameOf(pick(people).id)}` });
  }
  for (const c of comments) {
    const a = assets.find((x) => x.id === c.targetId)!;
    log({ at: c.createdAt, actorId: c.authorId, kind: 'commented', targetType: 'asset', targetId: a.id, targetLabel: label(a), summary: c.body });
  }
  for (let i = 0; i < 18; i++) {
    const k = pick(stock);
    const delta = Math.round(between(-12, 24)) || 3;
    log({
      at: iso(between(0.1, 25) * DAY),
      actorId: pick(members).id,
      kind: 'stock_adjusted',
      targetType: 'stock',
      targetId: k.id,
      targetLabel: `${k.sku} ${k.name}`,
      summary: delta > 0 ? `Received ${delta} ${k.unit}` : `Issued ${-delta} ${k.unit}`,
    });
  }

  // ── stock-takes ─────────────────────────────────────────────────────
  const hqAssets = assets.filter((a) => a.siteId === 's-hq' && a.status !== 'retired');
  const closed: CountSession = {
    id: 'count-hq-q3',
    name: 'Head office, quarter 3',
    siteId: 's-hq',
    placeIds: [],
    status: 'closed',
    startedAt: iso(21 * DAY),
    startedBy: 'p-lesego',
    closedAt: iso(20.7 * DAY),
    closedBy: 'p-lesego',
    expected: hqAssets.map((a) => ({ assetId: a.id, placeId: a.placeId })),
  };
  const moAssets = assets.filter((a) => a.siteId === 's-mochudi' && a.status !== 'retired' && a.status !== 'checked_out');
  const open: CountSession = {
    id: 'count-mochudi-t3',
    name: 'Mochudi, term 3',
    siteId: 's-mochudi',
    placeIds: [],
    status: 'open',
    startedAt: iso(0.09 * DAY),
    startedBy: 'p-lesego',
    expected: moAssets.map((a) => ({ assetId: a.id, placeId: a.placeId })),
  };
  const scans: CountScan[] = [];
  let si = 0;
  hqAssets.forEach((a, i) => {
    if (a.status === 'missing') return;
    const wrong = i % 17 === 5;
    const other = placesOf('s-hq').find((p) => p.id !== a.placeId);
    scans.push({
      id: `scan-${++si}`,
      countId: closed.id,
      code: a.tag,
      assetId: a.id,
      placeId: wrong ? other?.id : a.placeId,
      by: i % 2 ? 'p-lesego' : 'p-naledi',
      at: iso((21 - i * 0.004) * DAY),
      result: wrong ? 'wrong_place' : 'found',
    });
  });
  // The open count is about 60% done, by two people working different rooms.
  moAssets.forEach((a, i) => {
    if (i % 5 >= 3) return;
    const counter = /Classroom|Library/.test(places.find((p) => p.id === a.placeId)?.name ?? '') ? 'p-onalenna' : 'p-lesego';
    scans.push({
      id: `scan-${++si}`,
      countId: open.id,
      code: a.tag,
      assetId: a.id,
      placeId: a.placeId,
      by: counter,
      at: iso((0.085 - i * 0.0011) * DAY),
      result: 'found',
    });
  });
  log({ at: closed.startedAt, actorId: 'p-lesego', kind: 'count_started', targetType: 'count', targetId: closed.id, targetLabel: closed.name, summary: `Started a stock-take of ${hqAssets.length} assets` });
  log({ at: closed.closedAt!, actorId: 'p-lesego', kind: 'count_closed', targetType: 'count', targetId: closed.id, targetLabel: closed.name, summary: 'Closed the stock-take and exported the variance report' });
  log({ at: open.startedAt, actorId: 'p-lesego', kind: 'count_started', targetType: 'count', targetId: open.id, targetLabel: open.name, summary: `Started a stock-take of ${moAssets.length} assets with Onalenna Dube` });

  activity.sort((a, b) => b.at.localeCompare(a.at));

  // ── saved views ─────────────────────────────────────────────────────
  const views: SavedView[] = [
    { id: 'v-all', collection: 'assets', name: 'All assets', filters: [], builtIn: true, createdBy: 'p-kagiso' },
    { id: 'v-out', collection: 'assets', name: 'Checked out', filters: [{ field: 'status', op: 'is', value: 'checked_out' }], sort: { field: 'dueBack', dir: 'asc' }, createdBy: 'p-naledi' },
    { id: 'v-attention', collection: 'assets', name: 'Needs attention', filters: [{ field: 'status', op: 'is', value: 'in_repair,missing' }], createdBy: 'p-naledi' },
    { id: 'v-laptops', collection: 'assets', name: 'Laptops', filters: [{ field: 'category', op: 'is', value: 'Laptop' }], createdBy: 'p-tumelo' },
    { id: 'v-hq', collection: 'assets', name: 'Head office', filters: [{ field: 'siteId', op: 'is', value: 's-hq' }], createdBy: 'p-kagiso' },
    { id: 'v-stock-all', collection: 'stock', name: 'All stock', filters: [], builtIn: true, createdBy: 'p-kagiso' },
    { id: 'v-stock-low', collection: 'stock', name: 'Below reorder level', filters: [{ field: 'belowReorder', op: 'is', value: 'yes' }], createdBy: 'p-naledi' },
    { id: 'v-stock-exp', collection: 'stock', name: 'Expiring in 60 days', filters: [{ field: 'expiresOn', op: 'before', value: '+60' }], sort: { field: 'expiresOn', dir: 'asc' }, createdBy: 'p-boitumelo' },
  ];

  return {
    schema: SCHEMA,
    seededAt: now.toISOString(),
    workspace: { id: 'w-morula', name: 'Morula Community Trust', tagPrefix: 'MCT', currency: 'BWP', createdAt: iso(60 * DAY) },
    people,
    sites,
    places,
    assets,
    stock,
    comments,
    activity,
    views,
    counts: [open, closed],
    scans,
  };
}
