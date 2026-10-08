// The shapes Tagwise works with. These are the contract between the screens
// and the data layer: the browser-storage implementation fills them today,
// and the API will fill the same shapes later.

export type Role = 'owner' | 'admin' | 'editor' | 'viewer' | 'auditor';

/** Someone in the organisation. People with a `role` are workspace members
 *  who can sign in; the rest are custodians only (a teacher who borrows a
 *  projector). All names in the sample workspace are invented. */
export interface Person {
  id: string;
  name: string;
  initials: string;
  team: string;
  /** A CSS colour used to tint their avatar. */
  hue: string;
  role?: Role;
  email?: string;
  lastActiveAt?: string;
}

export type SiteKind = 'office' | 'warehouse' | 'school' | 'clinic';

export interface Site {
  id: string;
  code: string;
  name: string;
  kind: SiteKind;
  town: string;
  address: string;
  lat: number;
  lng: number;
}

/** A room or store within a site. */
export interface Place {
  id: string;
  siteId: string;
  name: string;
}

export type AssetStatus = 'in_use' | 'available' | 'checked_out' | 'in_repair' | 'missing' | 'retired';

export interface Asset {
  id: string;
  /** The code printed on the label and encoded in its QR code. */
  tag: string;
  name: string;
  category: string;
  model?: string;
  serial?: string;
  siteId: string;
  placeId?: string;
  status: AssetStatus;
  /** Who has it (a Person id). */
  custodianId?: string;
  /** When a checked-out item is due back (ISO date). */
  dueBack?: string;
  purchasedOn?: string;
  /** Purchase cost in pula. Illustrative only: this is a register, not accounts. */
  cost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  /** Bumped on every write; an edit made against an older version is a conflict. */
  version: number;
}

export interface StockItem {
  id: string;
  sku: string;
  /** EAN-13 printed on the product or shelf label. */
  barcode: string;
  name: string;
  category: string;
  unit: string;
  siteId: string;
  placeId?: string;
  quantity: number;
  reorderAt: number;
  batch?: string;
  expiresOn?: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export type TargetType = 'asset' | 'stock' | 'site' | 'count' | 'workspace' | 'member';

export interface Comment {
  id: string;
  targetType: 'asset' | 'stock';
  targetId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export type ActivityKind =
  | 'created'
  | 'updated'
  | 'checked_out'
  | 'returned'
  | 'moved'
  | 'commented'
  | 'imported'
  | 'count_started'
  | 'count_closed'
  | 'counted'
  | 'stock_adjusted'
  | 'labels_printed'
  | 'member_changed'
  | 'view_saved';

export interface Change {
  field: string;
  from: string;
  to: string;
}

export interface Activity {
  id: string;
  at: string;
  actorId: string;
  kind: ActivityKind;
  targetType?: TargetType;
  targetId?: string;
  /** What to call the target in the feed ("MCT-00042 Dell Latitude 5440"). */
  targetLabel?: string;
  summary: string;
  changes?: Change[];
}

export type Collection = 'assets' | 'stock';

export type FilterOp = 'is' | 'is_not' | 'contains' | 'is_empty' | 'not_empty' | 'lt' | 'lte' | 'gt' | 'before' | 'after';

export interface ViewFilter {
  field: string;
  op: FilterOp;
  value?: string;
}

export interface ViewSort {
  field: string;
  dir: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  collection: Collection;
  name: string;
  filters: ViewFilter[];
  sort?: ViewSort;
  /** Visible columns, in order. Missing means the collection's defaults. */
  columns?: string[];
  createdBy: string;
  builtIn?: boolean;
}

export type CountStatus = 'open' | 'closed';

export interface CountSession {
  id: string;
  name: string;
  siteId: string;
  /** The rooms or stores being counted; empty means the whole site. */
  placeIds: string[];
  status: CountStatus;
  startedAt: string;
  startedBy: string;
  closedAt?: string;
  closedBy?: string;
  /** Snapshot of what should be found, taken when the count starts. */
  expected: { assetId: string; placeId?: string }[];
}

export type ScanResult = 'found' | 'wrong_place' | 'unexpected' | 'unknown' | 'repeat';

export interface CountScan {
  id: string;
  countId: string;
  code: string;
  assetId?: string;
  placeId?: string;
  by: string;
  at: string;
  result: ScanResult;
}

export interface Workspace {
  id: string;
  name: string;
  /** Prefix for new tag codes ("MCT" makes MCT-00001). */
  tagPrefix: string;
  currency: string;
  createdAt: string;
}

/** Everything in one workspace. Browser storage keeps this whole object. */
export interface Db {
  schema: number;
  seededAt: string;
  workspace: Workspace;
  people: Person[];
  sites: Site[];
  places: Place[];
  assets: Asset[];
  stock: StockItem[];
  comments: Comment[];
  activity: Activity[];
  views: SavedView[];
  counts: CountSession[];
  scans: CountScan[];
}
