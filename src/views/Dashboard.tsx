import { useMemo, useState } from "react";
import { useApp } from "../App";
import { STAGES } from "../lib/types";
import { addDays, daysBetween, fmt, isOverdue, name, onTime, todayISO } from "../lib/util";
import { Pri } from "./common";

type Period = "month" | "quarter" | "d90";

export function Dashboard() {
  const { s, openItem } = useApp();
  const t = todayISO();
  const [period, setPeriod] = useState<Period>("month");
  const from = useMemo(() => {
    const d = new Date();
    if (period === "month") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    if (period === "quarter") return `${d.getFullYear()}-${String(Math.floor(d.getMonth() / 3) * 3 + 1).padStart(2, "0")}-01`;
    return addDays(t, -90);
  }, [period, t]);
  const periodLabel = { month: "tháng này", quarter: "quý này", d90: "90 ngày qua" }[period];

  const data = useMemo(() => {
    const groups = s.groups.filter((g) => g.active);
    const itemById = new Map(s.items.map((i) => [i.id, i]));
    const doneInPeriod = s.milestones.filter((m) => m.done_at && m.done_at >= from && m.done_at <= t && m.planned_date);
    const late = s.milestones.filter((m) => { const it = itemById.get(m.item_id); return it && it.status < 6 && isOverdue(m, t); });
    const golive = s.milestones.filter((m) => m.stage_id === 6 && m.done_at && m.done_at >= from && m.done_at <= t);
    const upcoming = s.milestones.filter((m) => m.stage_id === 6 && !m.done_at && m.planned_date && m.planned_date >= t && m.planned_date <= addDays(t, 30))
      .sort((a, b) => a.planned_date!.localeCompare(b.planned_date!));
    const perGroup = groups.map((g) => {
      const items = s.items.filter((i) => i.group_id === g.id);
      const ids = new Set(items.map((i) => i.id));
      const counts = [1, 2, 3, 4, 5, 6].map((st) => items.filter((i) => i.status === st).length);
      const gd = doneInPeriod.filter((m) => ids.has(m.item_id));
      return {
        g, total: items.length, active: items.filter((i) => i.status < 6).length, counts,
        late: late.filter((m) => ids.has(m.item_id)).length,
        onTime: gd.length ? Math.round((gd.filter(onTime).length / gd.length) * 100) : null, doneN: gd.length,
        golive: golive.filter((m) => ids.has(m.item_id)).length,
      };
    });
    return {
      perGroup, late: late.sort((a, b) => a.planned_date!.localeCompare(b.planned_date!)), golive, upcoming, itemById,
      active: s.items.filter((i) => i.status < 6).length,
      onTimeAll: doneInPeriod.length ? Math.round((doneInPeriod.filter(onTime).length / doneInPeriod.length) * 100) : null,
      doneN: doneInPeriod.length,
      lateItems: new Set(late.map((m) => m.item_id)).size,
    };
  }, [s, from, t]);

  const maxTotal = Math.max(1, ...data.perGroup.map((r) => r.total));
  const gName = (id: number) => s.groups.find((g) => g.id === id)?.name ?? "";

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Dashboard tổng quan <span className="muted small">· {fmt(t)}</span></h1>
        <div className="filters no-print">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
            <option value="month">Tháng này</option><option value="quarter">Quý này</option><option value="d90">90 ngày qua</option>
          </select>
          <button onClick={() => window.print()}>In / PDF</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><b>{data.active}</b><span>Item đang triển khai</span></div>
        <div className="stat ok"><b>{data.golive.length}</b><span>Golive {periodLabel}</span></div>
        <div className="stat late"><b>{data.late.length}</b><span>Mốc quá hạn ({data.lateItems} item)</span></div>
        <div className="stat"><b>{data.onTimeAll == null ? "—" : `${data.onTimeAll}%`}</b><span>Mốc xong đúng hạn {periodLabel} ({data.doneN} mốc)</span></div>
      </div>

      <section>
        <h2>Theo nhóm</h2>
        <table className="grid">
          <thead>
            <tr><th>Nhóm</th>{[1, 2, 3, 4, 5, 6].map((st) => <th key={st} className="num">{STAGES[st]}</th>)}<th style={{ width: "22%" }}>Phân bổ</th>
              <th className="num">Quá hạn</th><th className="num">Đúng hạn</th><th className="num">Golive kỳ</th></tr>
          </thead>
          <tbody>
            {data.perGroup.map((r) => (
              <tr key={r.g.id}>
                <td><b>{r.g.name}</b></td>
                {r.counts.map((c, i) => <td key={i} className="num">{c || <span className="muted">·</span>}</td>)}
                <td>
                  <div className="stack" style={{ width: `${(r.total / maxTotal) * 100}%` }}>
                    {r.counts.map((c, i) => c > 0 && <div key={i} className={`seg st${i + 1}`} style={{ flex: c }} title={`${STAGES[i + 1]}: ${c}`} />)}
                  </div>
                </td>
                <td className={"num" + (r.late ? " late" : "")}>{r.late}</td>
                <td className="num">{r.onTime == null ? "—" : `${r.onTime}%`}</td>
                <td className="num">{r.golive}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="legend small">{[1, 2, 3, 4, 5, 6].map((st) => <span key={st}><i className={`sq st${st}`} />{STAGES[st]}</span>)}</div>
      </section>

      <div className="two">
        <section>
          <h2 className="late">Mốc quá hạn</h2>
          {data.late.length === 0 ? <p className="muted">Không có.</p> : (
            <table className="grid hover">
              <thead><tr><th>Item</th><th>Nhóm</th><th>Mốc</th><th className="num">Trễ</th><th>PIC</th></tr></thead>
              <tbody>
                {data.late.slice(0, 15).map((m) => {
                  const it = data.itemById.get(m.item_id)!;
                  return (
                    <tr key={m.id} onClick={() => s.me.role !== "viewer" && openItem(it)}>
                      <td><span className="mono">{it.code}</span> {it.title} <Pri p={it.priority} /></td>
                      <td className="muted">{gName(it.group_id)}</td>
                      <td>{STAGES[m.stage_id]}</td>
                      <td className="num late">{daysBetween(m.planned_date!, t)}d</td>
                      <td className="muted">{name(s, it.pic_kd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section>
          <h2>Golive dự kiến 30 ngày tới</h2>
          {data.upcoming.length === 0 ? <p className="muted">Không có.</p> : (
            <table className="grid hover">
              <thead><tr><th>Ngày</th><th>Item</th><th>Nhóm</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {data.upcoming.map((m) => {
                  const it = data.itemById.get(m.item_id)!;
                  return (
                    <tr key={m.id} onClick={() => s.me.role !== "viewer" && openItem(it)}>
                      <td>{fmt(m.planned_date)}</td>
                      <td><span className="mono">{it.code}</span> {it.title}</td>
                      <td className="muted">{gName(it.group_id)}</td>
                      <td>{STAGES[it.status]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
