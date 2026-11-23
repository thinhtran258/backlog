import { useMemo, useState } from "react";
import { useApp } from "../App";
import type { Milestone } from "../lib/types";
import { STAGES } from "../lib/types";
import { addDays, daysBetween, fmt, isOverdue, msByItem, startOfWeek, todayISO } from "../lib/util";
import { GroupSelect, PicSelect, Pri, StatusPill, matchPic } from "./common";

export function Timeline() {
  const { s, openItem } = useApp();
  const t = todayISO();
  const [weeks, setWeeks] = useState(16);
  const [offset, setOffset] = useState(-2); // tuần bắt đầu so với tuần hiện tại
  const [group, setGroup] = useState<number | "">("");
  const [pic, setPic] = useState("");
  const [showDone, setShowDone] = useState(false);

  const start = addDays(startOfWeek(t), offset * 7);
  const total = weeks * 7;
  const end = addDays(start, total);
  const pos = (d: string) => (daysBetween(start, d) / total) * 100;
  const inRange = (d: string) => d >= start && d < end;

  const msMap = useMemo(() => msByItem(s.milestones), [s.milestones]);
  const groups = s.groups.filter((g) => g.active && (!group || g.id === group));
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(start, i * 7));

  const markerClass = (m: Milestone) =>
    m.done_at ? (m.planned_date && m.done_at > m.planned_date ? "mk donelate" : "mk done") : isOverdue(m, t) ? "mk late" : "mk plan";
  const markerDate = (m: Milestone) => m.done_at ?? m.planned_date;

  return (
    <div className="page">
      <div className="toolbar">
        <h1>Timeline</h1>
        <div className="filters">
          <button onClick={() => setOffset(offset - 4)}>◀ 4 tuần</button>
          <button onClick={() => setOffset(-2)}>Hôm nay</button>
          <button onClick={() => setOffset(offset + 4)}>4 tuần ▶</button>
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            <option value={8}>8 tuần</option><option value={16}>16 tuần</option><option value={26}>26 tuần</option>
          </select>
        </div>
      </div>
      <div className="filters wrap">
        <GroupSelect s={s} value={group} onChange={setGroup} />
        <PicSelect s={s} value={pic} onChange={setPic} />
        <label className="check"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Hiện item đã golive</label>
        <span className="legend">
          <i className="mk plan" /> Kế hoạch <i className="mk late" /> Quá hạn <i className="mk done" /> Xong đúng hạn <i className="mk donelate" /> Xong trễ
        </span>
      </div>

      <div className="gantt">
        <div className="g-row g-head">
          <div className="g-label">{fmt(start)} → {fmt(addDays(end, -1))}</div>
          <div className="g-track">
            {weekStarts.map((w) => (
              <div key={w} className="g-week" style={{ left: `${pos(w)}%`, width: `${(7 / total) * 100}%` }}>{fmt(w).slice(0, 5)}</div>
            ))}
          </div>
        </div>
        {groups.map((g) => {
          const items = s.items.filter((i) => i.group_id === g.id && (showDone || i.status < 6) && matchPic(i, pic))
            .sort((a, b) => a.priority.localeCompare(b.priority) || a.code.localeCompare(b.code));
          if (!items.length) return null;
          return (
            <div key={g.id}>
              <div className="g-group">{g.name} <span className="muted">({items.length})</span></div>
              {items.map((it) => {
                const ms = (msMap.get(it.id) ?? []).filter((m) => markerDate(m));
                const dates = ms.map((m) => markerDate(m)!).sort();
                const a = dates[0], b = dates[dates.length - 1];
                const barL = a ? Math.max(0, pos(a)) : 0, barR = b ? Math.min(100, pos(b)) : 0;
                return (
                  <div key={it.id} className="g-row" onClick={() => openItem(it)}>
                    <div className="g-label">
                      <span className="mono">{it.code}</span> <Pri p={it.priority} /> <span className="g-title" title={it.title}>{it.title}</span>
                      <StatusPill status={it.status} />
                    </div>
                    <div className="g-track">
                      {weekStarts.map((w) => <div key={w} className="g-line" style={{ left: `${pos(w)}%` }} />)}
                      {inRange(t) && <div className="g-today" style={{ left: `${pos(t)}%` }} />}
                      {a && b && barR > barL && <div className="g-bar" style={{ left: `${barL}%`, width: `${barR - barL}%` }} />}
                      {ms.filter((m) => inRange(markerDate(m)!)).map((m) => (
                        <div key={m.id} className={markerClass(m)} style={{ left: `${pos(markerDate(m)!)}%` }}
                          title={`${STAGES[m.stage_id]}\nKế hoạch: ${fmt(m.planned_date)}${m.done_at ? `\nHoàn thành: ${fmt(m.done_at)}` : ""}${m.note ? `\n${m.note}` : ""}`}>
                          <span>{m.stage_id}</span>
                        </div>
                      ))}
                      {ms.length === 0 && <span className="g-empty">chưa có ngày kế hoạch</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="muted small">Số trong mốc: 2 Phân tích · 3 Done đề bài · 4 Phát triển · 5 Test · 6 Golive. Rê chuột vào mốc để xem chi tiết.</p>
    </div>
  );
}
