import { useMemo, useState } from "react";
import { useApp } from "../App";
import type { Item, Milestone } from "../lib/types";
import { STAGES } from "../lib/types";
import { addDays, canEditGroup, daysBetween, fmt, name, todayISO } from "../lib/util";
import { GroupSelect, PicSelect, Pri, matchPic } from "./common";

interface Row { m: Milestone; it: Item }

export function Today() {
  const { s, api, run, openItem } = useApp();
  const [group, setGroup] = useState<number | "">("");
  const [pic, setPic] = useState<string>(s.me.role === "member" ? s.me.id : "");
  const t = todayISO();
  const weekEnd = addDays(t, 7);

  const { overdue, today, week, nodate } = useMemo(() => {
    const items = new Map(s.items.filter((i) => i.status < 6 && (!group || i.group_id === group) && matchPic(i, pic)).map((i) => [i.id, i]));
    const rows: Row[] = s.milestones.filter((m) => !m.done_at && items.has(m.item_id)).map((m) => ({ m, it: items.get(m.item_id)! }));
    const by = (a: Row, b: Row) => (a.m.planned_date ?? "").localeCompare(b.m.planned_date ?? "") || a.it.priority.localeCompare(b.it.priority);
    // Item chưa có ngày cho milestone kế tiếp
    const nodate: Row[] = [];
    for (const it of items.values()) {
      const next = s.milestones.filter((m) => m.item_id === it.id && !m.done_at && m.stage_id > it.status).sort((a, b) => a.stage_id - b.stage_id)[0];
      if (next && !next.planned_date) nodate.push({ m: next, it });
    }
    return {
      overdue: rows.filter((r) => r.m.planned_date && r.m.planned_date < t).sort(by),
      today: rows.filter((r) => r.m.planned_date === t).sort(by),
      week: rows.filter((r) => r.m.planned_date && r.m.planned_date > t && r.m.planned_date <= weekEnd).sort(by),
      nodate: nodate.sort((a, b) => a.it.priority.localeCompare(b.it.priority)),
    };
  }, [s, group, pic, t, weekEnd]);

  const groupName = (id: number) => s.groups.find((g) => g.id === id)?.name ?? "";

  const Table = ({ rows, kind }: { rows: Row[]; kind: "late" | "due" | "week" | "nodate" }) =>
    rows.length === 0 ? <p className="muted empty">Không có.</p> : (
      <table className="grid">
        <thead><tr><th style={{ width: 34 }}></th><th>Mã</th><th>Item</th><th>Nhóm</th><th>Mốc</th><th>Kế hoạch</th>{kind === "late" && <th>Trễ</th>}<th>PIC KD / GP</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {rows.map(({ m, it }) => {
            const editable = canEditGroup(s, it.group_id);
            return (
              <tr key={m.id}>
                <td>
                  <input type="checkbox" title={editable ? "Đánh dấu hoàn thành hôm nay" : "Không có quyền"} disabled={!editable || !m.planned_date && kind !== "nodate"}
                    onChange={() => run(() => api.saveMilestone(m.id, { done_at: t }), `${it.code}: hoàn thành "${STAGES[m.stage_id]}"`)} />
                </td>
                <td className="mono"><a onClick={() => openItem(it)}>{it.code}</a></td>
                <td><a onClick={() => openItem(it)}>{it.title}</a> <Pri p={it.priority} /></td>
                <td className="muted">{groupName(it.group_id)}</td>
                <td>{STAGES[m.stage_id]}</td>
                <td>{kind === "nodate" ? (
                  <input type="date" disabled={!editable} onChange={(e) => e.target.value && run(() => api.saveMilestone(m.id, { planned_date: e.target.value }), "Đã đặt ngày")} />
                ) : fmt(m.planned_date)}</td>
                {kind === "late" && <td className="late">{daysBetween(m.planned_date!, t)} ngày</td>}
                <td className="muted">{name(s, it.pic_kd)} / {name(s, it.pic_gp)}</td>
                <td className="note">{m.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Hôm nay · {fmt(t)}</h1>
        <div className="filters">
          <GroupSelect s={s} value={group} onChange={setGroup} />
          <PicSelect s={s} value={pic} onChange={setPic} />
        </div>
      </div>
      <div className="stats">
        <div className="stat late"><b>{overdue.length}</b><span>Quá hạn</span></div>
        <div className="stat due"><b>{today.length}</b><span>Đến hạn hôm nay</span></div>
        <div className="stat"><b>{week.length}</b><span>7 ngày tới</span></div>
        <div className="stat"><b>{nodate.length}</b><span>Chưa có ngày</span></div>
      </div>
      <section><h2 className="late">Quá hạn</h2><Table rows={overdue} kind="late" /></section>
      <section><h2>Đến hạn hôm nay</h2><Table rows={today} kind="due" /></section>
      <section><h2>7 ngày tới</h2><Table rows={week} kind="week" /></section>
      <section><h2>Mốc kế tiếp chưa có ngày kế hoạch</h2><Table rows={nodate} kind="nodate" /></section>
    </div>
  );
}
