import type { Item, Milestone, Snapshot } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const parseISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso: string, n: number) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
export const fmt = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y.slice(2)}`;
};
export const startOfWeek = (iso: string) => { const d = parseISO(iso); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return toISO(d); };

export const isOverdue = (m: Milestone, today = todayISO()) => !m.done_at && !!m.planned_date && m.planned_date < today;
export const onTime = (m: Milestone) => !!m.done_at && !!m.planned_date && m.done_at <= m.planned_date;

/** Milestone chưa xong đầu tiên của item (theo thứ tự giai đoạn) */
export function nextMilestone(item: Item, ms: Milestone[]): Milestone | undefined {
  return ms.filter((m) => m.item_id === item.id && !m.done_at && m.stage_id > item.status)
    .sort((a, b) => a.stage_id - b.stage_id)[0];
}

export function msByItem(ms: Milestone[]) {
  const map = new Map<number, Milestone[]>();
  for (const m of ms) { const a = map.get(m.item_id) ?? []; a.push(m); map.set(m.item_id, a); }
  for (const a of map.values()) a.sort((x, y) => x.stage_id - y.stage_id);
  return map;
}

export function canEditGroup(s: Snapshot, gid: number) {
  if (s.me.role === "admin") return true;
  return s.me.role === "member" && s.userGroups.some((u) => u.user_id === s.me.id && u.group_id === gid);
}

export const name = (s: Snapshot, id: string | null | undefined) =>
  id ? (s.profiles.find((p) => p.id === id)?.full_name || s.profiles.find((p) => p.id === id)?.username || "?") : "—";

export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function genPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const arr = new Uint32Array(10); crypto.getRandomValues(arr);
  arr.forEach((n) => (s += chars[n % chars.length]));
  return s.slice(0, 8) + String(arr[0] % 10) + "a";
}
