// Chế độ DEMO: dữ liệu giả trong trình duyệt, không cần Supabase. Mật khẩu mọi user: demo1234
import type { Api, AuditEntry, Group, Item, Lookup, Milestone, Product, Profile, Snapshot, UserGroup } from "./types";
import { MILESTONE_STAGES } from "./types";
import { addDays, todayISO } from "./util";

interface Db {
  profiles: Profile[]; groups: Group[]; products: Product[]; userGroups: UserGroup[];
  lookups: Lookup[]; items: Item[]; milestones: Milestone[]; audit: AuditEntry[]; seq: number;
}

const KEY = "mbv-backlog-demo-v1";

function seed(): Db {
  const p = (id: string, username: string, full_name: string, role: Profile["role"]): Profile =>
    ({ id, username, full_name, role, must_change_password: false, active: true });
  const profiles = [
    p("u0", "thinh", "Thịnh (Admin)", "admin"),
    p("u1", "an.kd", "Nguyễn An", "member"), p("u2", "binh.gp", "Trần Bình", "member"),
    p("u3", "chi.kd", "Lê Chi", "member"), p("u4", "dung.gp", "Phạm Dung", "member"),
    p("u5", "giang.kd", "Võ Giang", "member"), p("u6", "huong.gp", "Đỗ Hương", "member"),
    p("u7", "khoa.ops", "Bùi Khoa", "member"), p("u8", "gdk", "GĐ Khối", "viewer"),
  ];
  profiles.push({ ...p("u9", "moi.vao", "User mới", "member"), must_change_password: true });
  const groups: Group[] = [
    { id: 1, code: "ACQ", name: "Acquire", sort_order: 1, active: true },
    { id: 2, code: "RET", name: "Retention/Upsale", sort_order: 2, active: true },
    { id: 3, code: "UX", name: "Tiện ích/Trải nghiệm", sort_order: 3, active: true },
    { id: 4, code: "OPS", name: "Vận hành/Tuân thủ", sort_order: 4, active: true },
    { id: 5, code: "CD", name: "CD", sort_order: 5, active: true },
  ];
  const products: Product[] = [
    { id: 1, group_id: 5, name: "Sinh lời tự động", active: true },
    { id: 2, group_id: 5, name: "Chứng chỉ tiền gửi", active: true },
    { id: 3, group_id: 1, name: "Onboarding", active: true },
    { id: 4, group_id: 2, name: "Push/ZNS", active: true },
  ];
  const userGroups: UserGroup[] = [
    ["u1", 1], ["u2", 1], ["u3", 2], ["u3", 3], ["u4", 2], ["u4", 3], ["u5", 5], ["u6", 5], ["u7", 4],
  ].map(([user_id, group_id]) => ({ user_id: user_id as string, group_id: group_id as number }));
  let lid = 0;
  const lk = (category: Lookup["category"], vals: string[]) =>
    vals.map((value, i) => ({ id: ++lid, category, value, sort_order: i, active: true }));
  const lookups = [
    ...lk("kpi", ["Activation", "CASA", "KH đối tác về app", "Retention"]),
    ...lk("source", ["GĐ Khối", "Chủ tịch", "Đối tác", "Tuân thủ/NHNN", "Nội bộ"]),
    ...lk("item_type", ["Tính năng mới", "Cải tiến", "Sửa lỗi", "Tuân thủ bắt buộc"]),
    ...lk("partner", ["Đối tác A", "Đối tác B", "Đối tác C"]),
  ];

  const t = todayISO();
  // [title, group, product, priority, kd, gp, offsets planned (stage2..6), doneUpTo, kpi, partner]
  const rows: [string, number, number | null, Item["priority"], string, string, number[], number, string, string | null][] = [
    ["Liên kết ví tự động khi mở TK", 1, 3, "P0", "u1", "u2", [-40, -25, -10, 5, 20], 3, "Activation", "Đối tác A"],
    ["Đối soát C06 khi onboarding", 1, 3, "P0", "u1", "u2", [-30, -14, -3, 12, 30], 3, "Activation", null],
    ["Rút gọn luồng eKYC còn 3 bước", 1, 3, "P1", "u1", "u2", [-5, 7, 30, 50, 70], 1, "Activation", null],
    ["Mở TK từ kênh đối tác B", 1, null, "P1", "u1", "u2", [-60, -45, -20, -6, 3], 4, "KH đối tác về app", "Đối tác B"],
    ["ZNS nhắc KH chưa nạp tiền", 2, 4, "P0", "u3", "u4", [-20, -8, 0, 14, 28], 2, "CASA", null],
    ["Popup ưu đãi lần đăng nhập đầu", 2, 4, "P1", "u3", "u4", [-50, -35, -20, -10, -2], 6, "Retention", null],
    ["Phân khúc KH cho push theo hành vi", 2, 4, "P2", "u3", "u4", [3, 20, 45, 60, 80], 1, "Retention", null],
    ["Hôm nay ăn gì (pre-login)", 3, null, "P1", "u3", "u4", [-25, -12, 2, 25, 40], 2, "Activation", null],
    ["Thiết kế lại IA màn Home", 3, null, "P0", "u3", "u4", [-15, -4, 20, 40, 60], 1, "Retention", null],
    ["Ký số hợp đồng trên app", 3, null, "P1", "u3", "u4", [-35, -18, 1, 30, 55], 2, null as unknown as string, "Đối tác C"],
    ["Cập nhật thông tin KH theo chuẩn mới", 4, null, "P0", "u7", "u7", [-30, -20, -7, -1, 10], 3, null as unknown as string, null],
    ["Chuyển SMS OTP sang nhà mạng mới", 4, null, "P2", "u7", "u7", [10, 25, 45, 60, 75], 1, null as unknown as string, null],
    ["Sinh lời tự động — bật/tắt trên app", 5, 1, "P0", "u5", "u6", [-45, -30, -12, -2, 6], 4, "CASA", null],
    ["Sinh lời tự động — báo cáo lãi hằng ngày", 5, 1, "P1", "u5", "u6", [-10, 4, 25, 40, 55], 1, "CASA", null],
    ["Phân phối CD qua đối tác", 5, 2, "P1", "u5", "u6", [-70, -50, -30, -15, -5], 6, "CASA", "Đối tác B"],
    ["Màn danh mục CD trên app", 5, 2, "P2", "u5", "u6", [], 1, "CASA", null],
  ];
  const items: Item[] = [];
  const milestones: Milestone[] = [];
  const counters: Record<string, number> = {};
  let mid = 0;
  rows.forEach((r, i) => {
    const [title, group_id, product_id, priority, kd, gp, offs, doneUpTo, kpi, partner] = r;
    const g = groups.find((x) => x.id === group_id)!;
    counters[g.code] = (counters[g.code] ?? 0) + 1;
    const id = i + 1;
    items.push({
      id, code: `${g.code}-${String(counters[g.code]).padStart(3, "0")}`, title, description: "",
      group_id, product_id, priority, kpi: kpi ?? null, kpi_target: null, source: "GĐ Khối", item_type: "Tính năng mới",
      partner, pic_kd: kd, pic_gp: gp, link_pyc: null, link_figma: null, it_ticket: null, hard_deadline: null,
      status: doneUpTo, created_at: t, updated_at: t,
    });
    MILESTONE_STAGES.forEach((s, k) => {
      const planned = offs.length ? addDays(t, offs[k]) : null;
      const done = s <= doneUpTo && planned ? addDays(planned, k % 2 === 0 ? 0 : 2) : null;
      milestones.push({ id: ++mid, item_id: id, stage_id: s, planned_date: planned,
        done_at: done && done > t ? t : done, note: "", updated_by: kd, updated_at: t });
    });
  });
  return { profiles, groups, products, userGroups, lookups, items, milestones, audit: [], seq: 1000 };
}

export function createMockApi(): Api {
  let db: Db;
  try { db = JSON.parse(localStorage.getItem(KEY) ?? "null") ?? seed(); } catch { db = seed(); }
  let uid: string | null = null;
  try { uid = sessionStorage.getItem(KEY + "-uid"); } catch { /* ignore */ }
  const listeners = new Set<() => void>();
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
    listeners.forEach((l) => l());
  };
  const me = () => db.profiles.find((p) => p.id === uid)!;
  const canEdit = (gid: number) => me().role === "admin" ||
    (me().role === "member" && db.userGroups.some((u) => u.user_id === uid && u.group_id === gid));
  const log = (table: string, row: { id: number }, itemId: number, action: string, o: unknown, n: unknown) =>
    db.audit.push({ id: ++db.seq, table_name: table, row_id: row.id, item_id: itemId, action, changed_by: uid,
      changed_at: new Date().toISOString(), old_data: o as Record<string, unknown>, new_data: n as Record<string, unknown> });
  const derive = (itemId: number) => {
    const it = db.items.find((i) => i.id === itemId)!;
    const done = db.milestones.filter((m) => m.item_id === itemId && m.done_at).map((m) => m.stage_id);
    it.status = done.length ? Math.max(...done) : 1;
  };
  const delay = () => new Promise((r) => setTimeout(r, 120));

  return {
    mode: "demo",
    async currentUserId() { return uid; },
    async signIn(username, password) {
      await delay();
      const p = db.profiles.find((x) => x.username === username.trim().toLowerCase());
      if (!p || password !== "demo1234") throw new Error("Sai username hoặc mật khẩu (demo: mật khẩu demo1234)");
      if (!p.active) throw new Error("Tài khoản đã bị khóa");
      uid = p.id;
      try { sessionStorage.setItem(KEY + "-uid", uid); } catch { /* ignore */ }
    },
    async signOut() { uid = null; try { sessionStorage.removeItem(KEY + "-uid"); } catch { /* ignore */ } },
    async loadAll(): Promise<Snapshot> {
      await delay();
      const m = me();
      if (!m) throw new Error("Chưa đăng nhập");
      const c = structuredClone(db);
      return { me: m, profiles: c.profiles, groups: c.groups, products: c.products, userGroups: c.userGroups,
        lookups: c.lookups, items: c.items, milestones: c.milestones };
    },
    async saveItem(draft, plans) {
      await delay();
      if (!canEdit(draft.group_id)) throw new Error("Không có quyền sửa item trong nhóm này");
      const now = new Date().toISOString();
      if (draft.id) {
        const it = db.items.find((i) => i.id === draft.id)!;
        if (!canEdit(it.group_id)) throw new Error("Không có quyền");
        const old = { ...it };
        Object.assign(it, draft, { updated_at: now });
        log("items", it, it.id, "UPDATE", old, it);
      } else {
        const g = db.groups.find((x) => x.id === draft.group_id)!;
        const n = db.items.filter((i) => i.code.startsWith(g.code + "-")).length + 1;
        const id = ++db.seq;
        const { id: _omit, ...rest } = draft;
        void _omit;
        const it: Item = { ...rest, id, code: `${g.code}-${String(n).padStart(3, "0")}`, status: 1, created_at: now, updated_at: now };
        db.items.push(it);
        MILESTONE_STAGES.forEach((s) => db.milestones.push({ id: ++db.seq, item_id: id, stage_id: s,
          planned_date: plans?.[s]?.planned_date ?? null, done_at: plans?.[s]?.done_at ?? null,
          note: plans?.[s]?.note ?? "", updated_by: uid, updated_at: now }));
        derive(id);
        log("items", it, id, "INSERT", null, it);
      }
      persist();
    },
    async deleteItem(id) {
      await delay();
      if (me().role !== "admin") throw new Error("Chỉ admin được xóa");
      const it = db.items.find((i) => i.id === id)!;
      db.items = db.items.filter((i) => i.id !== id);
      db.milestones = db.milestones.filter((m) => m.item_id !== id);
      log("items", it, id, "DELETE", it, null);
      persist();
    },
    async saveMilestone(id, patch) {
      await delay();
      const m = db.milestones.find((x) => x.id === id)!;
      const it = db.items.find((i) => i.id === m.item_id)!;
      if (!canEdit(it.group_id)) throw new Error("Không có quyền sửa nhóm này");
      const old = { ...m };
      Object.assign(m, patch, { updated_by: uid, updated_at: new Date().toISOString() });
      derive(m.item_id);
      log("milestones", m, m.item_id, "UPDATE", old, m);
      persist();
    },
    async itemHistory(itemId) {
      return db.audit.filter((a) => a.item_id === itemId).reverse();
    },
    async changePassword(pw) {
      await delay();
      if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new Error("Mật khẩu tối thiểu 8 ký tự, có chữ và số");
      me().must_change_password = false; persist();
    },
    async createUser(u) {
      await delay();
      if (db.profiles.some((p) => p.username === u.username)) throw new Error("Username đã tồn tại");
      const id = "u" + ++db.seq;
      db.profiles.push({ id, username: u.username, full_name: u.full_name, role: u.role, must_change_password: true, active: true });
      u.group_ids.forEach((g) => db.userGroups.push({ user_id: id, group_id: g }));
      persist();
    },
    async resetPassword(userId) {
      await delay();
      db.profiles.find((p) => p.id === userId)!.must_change_password = true; persist();
    },
    async setActive(userId, active) {
      await delay();
      if (userId === uid) throw new Error("Không thể tự khóa chính mình");
      db.profiles.find((p) => p.id === userId)!.active = active; persist();
    },
    async updateProfile(userId, patch) {
      Object.assign(db.profiles.find((p) => p.id === userId)!, patch); persist();
    },
    async setUserGroups(userId, groupIds) {
      db.userGroups = db.userGroups.filter((u) => u.user_id !== userId).concat(groupIds.map((g) => ({ user_id: userId, group_id: g })));
      persist();
    },
    async saveGroup(g) {
      if (g.id) Object.assign(db.groups.find((x) => x.id === g.id)!, g);
      else db.groups.push({ id: ++db.seq, code: g.code!, name: g.name!, sort_order: g.sort_order ?? 99, active: true });
      persist();
    },
    async saveProduct(p) {
      if (p.id) Object.assign(db.products.find((x) => x.id === p.id)!, p);
      else db.products.push({ id: ++db.seq, group_id: p.group_id!, name: p.name!, active: true });
      persist();
    },
    async saveLookup(l) {
      if (l.id) Object.assign(db.lookups.find((x) => x.id === l.id)!, l);
      else db.lookups.push({ id: ++db.seq, category: l.category!, value: l.value!, sort_order: 99, active: true });
      persist();
    },
    subscribe(cb) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  };
}

export function resetDemo() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
