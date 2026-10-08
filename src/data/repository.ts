// The data-layer contract. Screens talk only to this interface. Today it is
// implemented by LocalRepository (browser storage, sample data); the Rust API
// will implement the same methods later, so screens do not change.

import type {
  Activity,
  ActivityKind,
  Asset,
  Comment,
  CountScan,
  CountSession,
  Collection,
  Person,
  Place,
  Role,
  SavedView,
  Site,
  StockItem,
  TargetType,
  ViewFilter,
  ViewSort,
  Workspace,
} from './types';

export interface TableQuery {
  filters?: ViewFilter[];
  search?: string;
  sort?: ViewSort;
}

/** A write either lands, or loses to a newer version someone else saved. */
export type SaveResult<T> = { ok: true; value: T } | { ok: false; reason: 'conflict'; current: T } | { ok: false; reason: 'not_found' | 'invalid'; message: string };

export type LookupResult =
  | { kind: 'asset'; asset: Asset }
  | { kind: 'stock'; item: StockItem }
  | { kind: 'none'; code: string };

export interface ActivityQuery {
  targetType?: TargetType;
  targetId?: string;
  kinds?: ActivityKind[];
  actorId?: string;
  limit?: number;
}

export type AssetInput = Omit<Asset, 'id' | 'tag' | 'createdAt' | 'updatedAt' | 'updatedBy' | 'version'> & { tag?: string };
export type StockInput = Omit<StockItem, 'id' | 'updatedAt' | 'updatedBy' | 'version'>;

export type DuplicateMode = 'skip' | 'update' | 'create';

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

export interface CountDetail {
  session: CountSession;
  scans: CountScan[];
}

export interface Repository {
  // reads
  workspace(): Promise<Workspace>;
  people(): Promise<Person[]>;
  sites(): Promise<Site[]>;
  places(): Promise<Place[]>;
  assets(q?: TableQuery): Promise<Asset[]>;
  asset(idOrTag: string): Promise<Asset | null>;
  stock(q?: TableQuery): Promise<StockItem[]>;
  stockItem(id: string): Promise<StockItem | null>;
  lookup(code: string): Promise<LookupResult>;
  comments(targetType: Comment['targetType'], targetId: string): Promise<Comment[]>;
  activity(q?: ActivityQuery): Promise<Activity[]>;
  views(collection: Collection): Promise<SavedView[]>;
  counts(): Promise<CountSession[]>;
  count(id: string): Promise<CountDetail | null>;

  // writes (actorId is the person doing it; the API will take it from the session)
  createAsset(input: AssetInput, actorId: string): Promise<Asset>;
  updateAsset(id: string, patch: Partial<AssetInput>, expectedVersion: number, actorId: string): Promise<SaveResult<Asset>>;
  checkOut(id: string, custodianId: string, dueBack: string, actorId: string): Promise<SaveResult<Asset>>;
  checkIn(id: string, actorId: string): Promise<SaveResult<Asset>>;
  adjustStock(id: string, delta: number, reason: string, actorId: string): Promise<SaveResult<StockItem>>;
  addComment(targetType: Comment['targetType'], targetId: string, body: string, actorId: string): Promise<Comment>;
  saveView(view: Omit<SavedView, 'id'> & { id?: string }, actorId: string): Promise<SavedView>;
  deleteView(id: string): Promise<void>;
  importAssets(rows: AssetInput[], mode: DuplicateMode, fileName: string, actorId: string): Promise<ImportSummary>;
  importStock(rows: StockInput[], mode: DuplicateMode, fileName: string, actorId: string): Promise<ImportSummary>;
  startCount(input: { name: string; siteId: string; placeIds: string[] }, actorId: string): Promise<CountSession>;
  recordScan(countId: string, code: string, placeId: string | undefined, by: string): Promise<CountScan>;
  closeCount(id: string, markMissing: boolean, actorId: string): Promise<CountSession>;
  setRole(personId: string, role: Role | undefined, actorId: string): Promise<Person>;
  invite(input: { name: string; email: string; role: Role; team: string }, actorId: string): Promise<Person>;
  logLabelsPrinted(assetIds: string[], actorId: string): Promise<void>;
  renameWorkspace(name: string, actorId: string): Promise<Workspace>;
  reset(): Promise<void>;

  /** Called after any change, made here or in another tab. */
  subscribe(listener: () => void): () => void;
}
