export type Role = "admin" | "member" | "viewer";

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: Role;
  must_change_password: boolean;
  active: boolean;
}

export interface Group { id: number; code: string; name: string; sort_order: number; active: boolean }
export interface Product { id: number; group_id: number; name: string; active: boolean }
export interface UserGroup { user_id: string; group_id: number }
export type LookupCategory = "kpi" | "source" | "item_type" | "partner";
export interface Lookup { id: number; category: LookupCategory; value: string; sort_order: number; active: boolean }

export interface Item {
  id: number;
  code: string;
  title: string;
  description: string;
  group_id: number;
  product_id: number | null;
  priority: "P0" | "P1" | "P2";
  kpi: string | null;
  kpi_target: string | null;
  source: string | null;
  item_type: string | null;
  partner: string | null;
  pic_kd: string | null;
  pic_gp: string | null;
  link_pyc: string | null;
  link_figma: string | null;
  it_ticket: string | null;
  hard_deadline: string | null;
  status: number;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  item_id: number;
  stage_id: number;
  planned_date: string | null;
  done_at: string | null;
  note: string;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditEntry {
  id: number;
  table_name: string;
  row_id: number;
  item_id: number | null;
  action: string;
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface Snapshot {
  me: Profile;
  profiles: Profile[];
  groups: Group[];
  products: Product[];
  userGroups: UserGroup[];
  lookups: Lookup[];
  items: Item[];
  milestones: Milestone[];
}

export type ItemDraft = Omit<Item, "id" | "code" | "status" | "created_at" | "updated_at"> & { id?: number };
export interface MilestonePatch { planned_date?: string | null; done_at?: string | null; note?: string }

export interface NewUser { username: string; full_name: string; role: Role; password: string; group_ids: number[] }

export interface Api {
  mode: "supabase" | "demo";
  currentUserId(): Promise<string | null>;
  signIn(username: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  loadAll(): Promise<Snapshot>;
  saveItem(draft: ItemDraft, plans?: Record<number, MilestonePatch>): Promise<void>;
  deleteItem(id: number): Promise<void>;
  saveMilestone(id: number, patch: MilestonePatch): Promise<void>;
  itemHistory(itemId: number): Promise<AuditEntry[]>;
  changePassword(pw: string): Promise<void>;
  createUser(u: NewUser): Promise<void>;
  resetPassword(userId: string, pw: string): Promise<void>;
  setActive(userId: string, active: boolean): Promise<void>;
  updateProfile(userId: string, patch: { full_name?: string; role?: Role }): Promise<void>;
  setUserGroups(userId: string, groupIds: number[]): Promise<void>;
  saveGroup(g: Partial<Group>): Promise<void>;
  saveProduct(p: Partial<Product>): Promise<void>;
  saveLookup(l: Partial<Lookup>): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

export const STAGES: Record<number, string> = {
  1: "Open",
  2: "Đang phân tích",
  3: "Done đề bài",
  4: "Đang phát triển",
  5: "Đang test",
  6: "Đã golive",
};
export const MILESTONE_STAGES = [2, 3, 4, 5, 6];
