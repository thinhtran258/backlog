import type { Item, Milestone, Snapshot } from "../lib/types";
import { STAGES } from "../lib/types";
import { todayISO } from "../lib/util";

export function GroupSelect({ s, value, onChange, all = "Tất cả nhóm" }:
  { s: Snapshot; value: number | ""; onChange: (v: number | "") => void; all?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}>
      <option value="">{all}</option>
      {s.groups.filter((g) => g.active).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );
}

export function PicSelect({ s, value, onChange }: { s: Snapshot; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Tất cả PIC</option>
      <option value={s.me.id}>— Việc của tôi —</option>
      {s.profiles.filter((p) => p.active && p.role !== "viewer").map((p) => (
        <option key={p.id} value={p.id}>{p.full_name || p.username}</option>
      ))}
    </select>
  );
}

export const StatusPill = ({ status }: { status: number }) => <span className={`pill st${status}`}>{STAGES[status]}</span>;
export const Pri = ({ p }: { p: string }) => <span className={`pri ${p}`}>{p}</span>;

export function MsDate({ m }: { m: Milestone | undefined }) {
  if (!m) return <span className="muted">—</span>;
  if (!m.planned_date) return <span className="muted">{STAGES[m.stage_id]} · chưa có ngày</span>;
  const t = todayISO();
  const cls = m.done_at ? "ok" : m.planned_date < t ? "late" : m.planned_date === t ? "due" : "";
  const [, mm, dd] = m.planned_date.split("-");
  return <span className={"msdate " + cls}>{STAGES[m.stage_id]} · {dd}/{mm}</span>;
}

export const matchPic = (it: Item, pic: string) => !pic || it.pic_kd === pic || it.pic_gp === pic;
