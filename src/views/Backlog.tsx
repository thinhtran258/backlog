import { useMemo, useState } from "react";
import { useApp } from "../App";
import { STAGES } from "../lib/types";
import { canEditGroup, downloadCSV, fmt, isOverdue, msByItem, name, nextMilestone, todayISO } from "../lib/util";
import { GroupSelect, MsDate, PicSelect, Pri, StatusPill, matchPic } from "./common";

export function Backlog() {
  const { s, openItem } = useApp();
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<number | "">("");
  const [product, setProduct] = useState<number | "">("");
  const [status, setStatus] = useState<string>("active");
  const [pri, setPri] = useState("");
  const [pic, setPic] = useState("");
  const [lateOnly, setLateOnly] = useState(false);

  const msMap = useMemo(() => msByItem(s.milestones), [s.milestones]);
  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return s.items.filter((it) => {
      if (group && it.group_id !== group) return false;
      if (product && it.product_id !== product) return false;
      if (status === "active" && it.status === 6) return false;
      if (status && status !== "active" && it.status !== Number(status)) return false;
      if (pri && it.priority !== pri) return false;
      if (!matchPic(it, pic)) return false;
      if (lateOnly && !(msMap.get(it.id) ?? []).some((m) => isOverdue(m))) return false;
      if (kw && !`${it.code} ${it.title} ${it.partner ?? ""} ${it.description}`.toLowerCase().includes(kw)) return false;
      return true;
    }).sort((a, b) => a.priority.localeCompare(b.priority) || a.code.localeCompare(b.code));
  }, [s.items, q, group, product, status, pri, pic, lateOnly, msMap]);

  const groupName = (id: number) => s.groups.find((g) => g.id === id)?.name ?? "";
  const prodName = (id: number | null) => (id ? s.products.find((p) => p.id === id)?.name : "") ?? "";
  const canAdd = s.me.role === "admin" || s.groups.some((g) => canEditGroup(s, g.id));

  const exportCSV = () => {
    const head = ["Mã", "Tên", "Nhóm", "Sản phẩm", "Ưu tiên", "Trạng thái", "Mốc kế tiếp", "Ngày KH mốc kế tiếp", "Quá hạn",
      "PIC KD", "PIC GP", "KPI", "Mục tiêu KPI", "Nguồn", "Loại", "Đối tác", "Deadline cứng", "PYC", "Figma", "Ticket IT"];
    const body = rows.map((it) => {
      const nx = nextMilestone(it, s.milestones);
      return [it.code, it.title, groupName(it.group_id), prodName(it.product_id), it.priority, STAGES[it.status],
        nx ? STAGES[nx.stage_id] : "", nx?.planned_date ?? "", (msMap.get(it.id) ?? []).some((m) => isOverdue(m)) ? "Có" : "",
        name(s, it.pic_kd), name(s, it.pic_gp), it.kpi, it.kpi_target, it.source, it.item_type, it.partner, it.hard_deadline,
        it.link_pyc, it.link_figma, it.it_ticket];
    });
    downloadCSV(`backlog_${todayISO()}.csv`, [head, ...body]);
  };

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Backlog <span className="muted">({rows.length})</span></h1>
        <div className="filters">
          <button onClick={exportCSV}>Xuất CSV</button>
          {canAdd && <button className="primary" onClick={() => openItem("new")}>+ Thêm item</button>}
        </div>
      </div>
      <div className="filters wrap">
        <input placeholder="Tìm mã, tên, đối tác…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
        <GroupSelect s={s} value={group} onChange={(v) => { setGroup(v); setProduct(""); }} />
        <select value={product} onChange={(e) => setProduct(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Tất cả sản phẩm</option>
          {s.products.filter((p) => p.active && (!group || p.group_id === group)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Chưa golive</option>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={pri} onChange={(e) => setPri(e.target.value)}>
          <option value="">Mọi ưu tiên</option><option>P0</option><option>P1</option><option>P2</option>
        </select>
        <PicSelect s={s} value={pic} onChange={setPic} />
        <label className="check"><input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} /> Chỉ item có mốc quá hạn</label>
      </div>
      <table className="grid hover">
        <thead><tr><th>Mã</th><th>Item</th><th>Nhóm / Sản phẩm</th><th>Ưu tiên</th><th>Trạng thái</th><th>Mốc kế tiếp</th><th>PIC KD</th><th>PIC GP</th><th>Đối tác</th><th>Cập nhật</th></tr></thead>
        <tbody>
          {rows.map((it) => {
            const late = (msMap.get(it.id) ?? []).some((m) => isOverdue(m));
            return (
              <tr key={it.id} onClick={() => openItem(it)} className={late ? "rowlate" : ""}>
                <td className="mono">{it.code}</td>
                <td>{it.title}</td>
                <td className="muted">{groupName(it.group_id)}{it.product_id ? ` · ${prodName(it.product_id)}` : ""}</td>
                <td><Pri p={it.priority} /></td>
                <td><StatusPill status={it.status} /></td>
                <td><MsDate m={nextMilestone(it, s.milestones)} /></td>
                <td>{name(s, it.pic_kd)}</td>
                <td>{name(s, it.pic_gp)}</td>
                <td className="muted">{it.partner ?? ""}</td>
                <td className="muted">{fmt(it.updated_at)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={10} className="muted empty">Không có item phù hợp.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
