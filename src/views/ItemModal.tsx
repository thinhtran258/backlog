import { useEffect, useMemo, useState } from "react";
import { useApp } from "../App";
import type { AuditEntry, Item, ItemDraft, Milestone, MilestonePatch } from "../lib/types";
import { MILESTONE_STAGES, STAGES } from "../lib/types";
import { canEditGroup, fmt, isOverdue, name, todayISO } from "../lib/util";
import { StatusPill } from "./common";

const EMPTY: ItemDraft = {
  title: "", description: "", group_id: 0, product_id: null, priority: "P1", kpi: null, kpi_target: null, source: null,
  item_type: null, partner: null, pic_kd: null, pic_gp: null, link_pyc: null, link_figma: null, it_ticket: null, hard_deadline: null,
};

const LABELS: Record<string, string> = {
  title: "Tên", description: "Mô tả", group_id: "Nhóm", product_id: "Sản phẩm", priority: "Ưu tiên", kpi: "KPI", kpi_target: "Mục tiêu KPI",
  source: "Nguồn", item_type: "Loại", partner: "Đối tác", pic_kd: "PIC KD", pic_gp: "PIC GP", link_pyc: "Link PYC", link_figma: "Link Figma",
  it_ticket: "Ticket IT", hard_deadline: "Deadline cứng", planned_date: "Ngày KH", done_at: "Hoàn thành", note: "Ghi chú",
};

type MsState = Record<number, { id?: number; planned_date: string | null; done_at: string | null; note: string }>;

export function ItemModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { s, api, run } = useApp();
  const editableGroups = s.groups.filter((g) => g.active && canEditGroup(s, g.id));
  const [d, setD] = useState<ItemDraft>(() => item
    ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (item as unknown as Record<string, unknown>)[k]])) as ItemDraft
    : { ...EMPTY, group_id: editableGroups[0]?.id ?? 0 });
  const original = useMemo(() => s.milestones.filter((m) => item && m.item_id === item.id), [s.milestones, item]);
  const [ms, setMs] = useState<MsState>(() => {
    const st: MsState = {};
    for (const sid of MILESTONE_STAGES) {
      const m = original.find((x) => x.stage_id === sid);
      st[sid] = { id: m?.id, planned_date: m?.planned_date ?? null, done_at: m?.done_at ?? null, note: m?.note ?? "" };
    }
    return st;
  });
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [busy, setBusy] = useState(false);

  const live = item ? s.items.find((i) => i.id === item.id) ?? item : null;
  const editable = item ? canEditGroup(s, item.group_id) : editableGroups.length > 0;
  const isAdmin = s.me.role === "admin";
  const t = todayISO();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const nul = (v: string) => (v.trim() === "" ? null : v);
  const setM = (sid: number, patch: Partial<MsState[number]>) => setMs((x) => ({ ...x, [sid]: { ...x[sid], ...patch } }));
  const lookups = (cat: string) => s.lookups.filter((l) => l.category === cat && l.active);
  const members = s.profiles.filter((p) => p.active && p.role !== "viewer");

  const save = async () => {
    if (!d.title.trim()) return;
    setBusy(true);
    const ok = await run(async () => {
      if (!item) {
        const plans: Record<number, MilestonePatch> = {};
        for (const sid of MILESTONE_STAGES) plans[sid] = { planned_date: ms[sid].planned_date, done_at: ms[sid].done_at, note: ms[sid].note };
        await api.saveItem(d, plans);
        return;
      }
      const changed = (Object.keys(EMPTY) as (keyof ItemDraft)[]).some((k) => (d[k] ?? null) !== ((item as unknown as ItemDraft)[k] ?? null));
      if (changed) await api.saveItem({ ...d, id: item.id });
      for (const sid of MILESTONE_STAGES) {
        const o = original.find((m) => m.stage_id === sid) as Milestone | undefined;
        const n = ms[sid];
        if (!o) continue;
        const patch: MilestonePatch = {};
        if ((o.planned_date ?? null) !== n.planned_date) patch.planned_date = n.planned_date;
        if ((o.done_at ?? null) !== n.done_at) patch.done_at = n.done_at;
        if (o.note !== n.note) patch.note = n.note;
        if (Object.keys(patch).length) await api.saveMilestone(o.id, patch);
      }
    }, item ? "Đã lưu" : "Đã tạo item");
    setBusy(false);
    if (ok) onClose();
  };

  const remove = async () => {
    if (!item || !confirmDelete()) return;
    if (await run(() => api.deleteItem(item.id), "Đã xóa item")) onClose();
  };
  const [delArmed, setDelArmed] = useState(false);
  const confirmDelete = () => { if (delArmed) return true; setDelArmed(true); setTimeout(() => setDelArmed(false), 3000); return false; };

  const fmtVal = (k: string, v: unknown) => {
    if (v == null || v === "") return "∅";
    if (k === "pic_kd" || k === "pic_gp") return name(s, String(v));
    if (k === "group_id") return s.groups.find((g) => g.id === v)?.name ?? String(v);
    if (k === "product_id") return s.products.find((p) => p.id === v)?.name ?? String(v);
    if (k === "planned_date" || k === "done_at" || k === "hard_deadline") return fmt(String(v));
    return String(v);
  };
  const describe = (a: AuditEntry) => {
    if (a.action === "INSERT") return "Tạo item";
    if (a.action === "DELETE") return "Xóa item";
    const o = a.old_data ?? {}, n = a.new_data ?? {};
    const prefix = a.table_name === "milestones" ? `Mốc "${STAGES[Number(n.stage_id)]}": ` : "";
    const diffs = Object.keys(LABELS).filter((k) => k in n && JSON.stringify(o[k]) !== JSON.stringify(n[k]))
      .map((k) => `${LABELS[k]}: ${fmtVal(k, o[k])} → ${fmtVal(k, n[k])}`);
    return prefix + (diffs.join("; ") || "cập nhật");
  };

  const ro = !editable;
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            {live ? <><span className="mono">{live.code}</span> <StatusPill status={live.status} /></> : <b>Item mới</b>}
            {ro && <span className="muted small"> · chỉ xem (không thuộc nhóm anh/chị phụ trách)</span>}
          </div>
          <button className="link" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form">
            <label className="full">Tên item *<input value={d.title} disabled={ro} onChange={(e) => set("title", e.target.value)} /></label>
            <label>Nhóm
              <select value={d.group_id} disabled={ro} onChange={(e) => { set("group_id", Number(e.target.value)); set("product_id", null); }}>
                {(ro ? s.groups : editableGroups).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label>Sản phẩm
              <select value={d.product_id ?? ""} disabled={ro} onChange={(e) => set("product_id", e.target.value ? Number(e.target.value) : null)}>
                <option value="">—</option>
                {s.products.filter((p) => p.group_id === d.group_id && (p.active || p.id === d.product_id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label>Ưu tiên
              <select value={d.priority} disabled={ro} onChange={(e) => set("priority", e.target.value as ItemDraft["priority"])}>
                <option>P0</option><option>P1</option><option>P2</option>
              </select>
            </label>
            <label>Deadline cứng<input type="date" value={d.hard_deadline ?? ""} disabled={ro} onChange={(e) => set("hard_deadline", nul(e.target.value))} /></label>
            <label>PIC Kinh doanh
              <select value={d.pic_kd ?? ""} disabled={ro} onChange={(e) => set("pic_kd", nul(e.target.value))}>
                <option value="">—</option>{members.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.username}</option>)}
              </select>
            </label>
            <label>PIC Giải pháp
              <select value={d.pic_gp ?? ""} disabled={ro} onChange={(e) => set("pic_gp", nul(e.target.value))}>
                <option value="">—</option>{members.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.username}</option>)}
              </select>
            </label>
            {(["kpi", "source", "item_type", "partner"] as const).map((k) => (
              <label key={k}>{LABELS[k]}
                <select value={d[k] ?? ""} disabled={ro} onChange={(e) => set(k, nul(e.target.value))}>
                  <option value="">—</option>
                  {lookups(k).map((l) => <option key={l.id}>{l.value}</option>)}
                  {d[k] && !lookups(k).some((l) => l.value === d[k]) && <option>{d[k]}</option>}
                </select>
              </label>
            ))}
            <label>Mục tiêu KPI<input value={d.kpi_target ?? ""} disabled={ro} placeholder="VD: +5.000 KH active" onChange={(e) => set("kpi_target", nul(e.target.value))} /></label>
            <label>Ticket IT<input value={d.it_ticket ?? ""} disabled={ro} onChange={(e) => set("it_ticket", nul(e.target.value))} /></label>
            <label>Link PYC/BRD<input value={d.link_pyc ?? ""} disabled={ro} onChange={(e) => set("link_pyc", nul(e.target.value))} /></label>
            <label>Link Figma<input value={d.link_figma ?? ""} disabled={ro} onChange={(e) => set("link_figma", nul(e.target.value))} /></label>
            <label className="full">Mô tả<textarea rows={3} value={d.description} disabled={ro} onChange={(e) => set("description", e.target.value)} /></label>
          </div>

          <h3>Milestone</h3>
          <table className="grid ms">
            <thead><tr><th>Mốc</th><th>Ngày kế hoạch</th><th>Hoàn thành</th><th>Ghi chú</th></tr></thead>
            <tbody>
              {MILESTONE_STAGES.map((sid) => {
                const m = ms[sid];
                const late = isOverdue({ ...m, id: 0, item_id: 0, stage_id: sid, updated_by: null, updated_at: "" }, t);
                return (
                  <tr key={sid} className={late ? "rowlate" : ""}>
                    <td>{STAGES[sid]}</td>
                    <td><input type="date" value={m.planned_date ?? ""} disabled={ro} onChange={(e) => setM(sid, { planned_date: nul(e.target.value) })} /></td>
                    <td className="nowrap">
                      <input type="checkbox" checked={!!m.done_at} disabled={ro} onChange={(e) => setM(sid, { done_at: e.target.checked ? t : null })} />{" "}
                      {m.done_at && (isAdmin
                        ? <input type="date" value={m.done_at} onChange={(e) => setM(sid, { done_at: nul(e.target.value) })} />
                        : <span className={m.planned_date && m.done_at > m.planned_date ? "late" : "ok"}>{fmt(m.done_at)}</span>)}
                    </td>
                    <td><input value={m.note} disabled={ro} placeholder="Ghi chú" onChange={(e) => setM(sid, { note: e.target.value })} style={{ width: "100%" }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted small">Trạng thái item = mốc cao nhất đã hoàn thành. Ngày hoàn thành tự ghi theo ngày tick.</p>

          {item && (
            <>
              <h3>Lịch sử thay đổi {history === null && <button className="link" onClick={async () => setHistory(await api.itemHistory(item.id))}>Xem</button>}</h3>
              {history && (history.length === 0 ? <p className="muted">Chưa có.</p> : (
                <ul className="history">
                  {history.map((a) => <li key={a.id}><span className="muted">{new Date(a.changed_at).toLocaleString("vi-VN")} · {name(s, a.changed_by)}</span> — {describe(a)}</li>)}
                </ul>
              ))}
            </>
          )}
        </div>

        <div className="modal-foot">
          {item && isAdmin && <button className="danger" onClick={remove}>{delArmed ? "Bấm lần nữa để xóa" : "Xóa"}</button>}
          <span style={{ flex: 1 }} />
          <button onClick={onClose}>Đóng</button>
          {editable && <button className="primary" disabled={busy || !d.title.trim() || !d.group_id} onClick={save}>{busy ? "Đang lưu…" : "Lưu"}</button>}
        </div>
      </div>
    </div>
  );
}
