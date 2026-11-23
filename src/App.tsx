import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Api, Item, Snapshot } from "./lib/types";
import { isOverdue } from "./lib/util";
import { Login, ChangePassword } from "./views/Auth";
import { Today } from "./views/Today";
import { Backlog } from "./views/Backlog";
import { Timeline } from "./views/Timeline";
import { Dashboard } from "./views/Dashboard";
import { Admin } from "./views/Admin";
import { ItemModal } from "./views/ItemModal";
import { resetDemo } from "./lib/mockApi";
export const BRAND = import.meta.env.VITE_DEMO ? "Backlog · Demo" : "MBV · Backlog";

interface Ctx {
  s: Snapshot;
  api: Api;
  reload: () => Promise<void>;
  toast: (msg: string, err?: boolean) => void;
  openItem: (item: Item | "new") => void;
  run: (fn: () => Promise<void>, ok?: string) => Promise<boolean>;
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

type Tab = "today" | "backlog" | "timeline" | "dashboard" | "admin";
const TABS: { id: Tab; label: string; roles: string[] }[] = [
  { id: "today", label: "Hôm nay", roles: ["admin", "member"] },
  { id: "backlog", label: "Backlog", roles: ["admin", "member"] },
  { id: "timeline", label: "Timeline", roles: ["admin", "member"] },
  { id: "dashboard", label: "Dashboard", roles: ["admin", "member", "viewer"] },
  { id: "admin", label: "Quản trị", roles: ["admin"] },
];

export default function App({ api }: { api: Api }) {
  const [s, setS] = useState<Snapshot | null>(null);
  const [phase, setPhase] = useState<"loading" | "login" | "ready">("loading");
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || "today");
  const [toastMsg, setToastMsg] = useState<{ msg: string; err?: boolean } | null>(null);
  const [modal, setModal] = useState<Item | "new" | null>(null);
  const [pwOpen, setPwOpen] = useState(false);

  const toast = useCallback((msg: string, err?: boolean) => {
    setToastMsg({ msg, err });
    setTimeout(() => setToastMsg(null), err ? 5000 : 2500);
  }, []);

  const reload = useCallback(async () => {
    try {
      if (!(await api.currentUserId())) { setPhase("login"); return; }
      setS(await api.loadAll());
      setPhase("ready");
    } catch (e) {
      toast((e as Error).message, true);
      setPhase("login");
    }
  }, [api, toast]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => (phase === "ready" ? api.subscribe(reload) : undefined), [api, phase, reload]);
  useEffect(() => { location.hash = tab; }, [tab]);

  const run = useCallback(async (fn: () => Promise<void>, ok?: string) => {
    try { await fn(); if (ok) toast(ok); await reload(); return true; }
    catch (e) { toast((e as Error).message, true); return false; }
  }, [reload, toast]);

  const overdue = useMemo(() => {
    if (!s) return 0;
    const live = new Set(s.items.filter((i) => i.status < 6).map((i) => i.id));
    return s.milestones.filter((m) => live.has(m.item_id) && isOverdue(m)).length;
  }, [s]);

  const toastEl = toastMsg && <div className={"toast" + (toastMsg.err ? " err" : "")}>{toastMsg.msg}</div>;

  if (phase === "loading") return <div className="center muted">Đang tải…</div>;
  if (phase === "login" || !s) return <>{<Login api={api} onDone={reload} />}{toastEl}</>;
  if (s.me.must_change_password) return <>{<ChangePassword api={api} onDone={reload} first />}{toastEl}</>;

  const tabs = TABS.filter((t) => t.roles.includes(s.me.role));
  const current = tabs.find((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <AppCtx.Provider value={{ s, api, reload, toast, openItem: setModal, run }}>
      <header className="top no-print">
        <div className="brand">{BRAND}</div>
        <nav>
          {tabs.map((t) => (
            <button key={t.id} className={current === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === "today" && overdue > 0 && <span className="badge">{overdue}</span>}
            </button>
          ))}
        </nav>
        <div className="user">
          {api.mode === "demo" && (
            <button className="link" title="Xóa dữ liệu demo đã sửa" onClick={() => { resetDemo(); location.reload(); }}>Reset demo</button>
          )}
          <span>{s.me.full_name || s.me.username}</span>
          <span className="role">{s.me.role}</span>
          <button className="link" onClick={() => setPwOpen(true)}>Đổi mật khẩu</button>
          <button className="link" onClick={async () => { await api.signOut(); setS(null); setPhase("login"); }}>Thoát</button>
        </div>
      </header>
      <main>
        {current === "today" && <Today />}
        {current === "backlog" && <Backlog />}
        {current === "timeline" && <Timeline />}
        {current === "dashboard" && <Dashboard />}
        {current === "admin" && <Admin />}
      </main>
      {modal && <ItemModal item={modal === "new" ? null : modal} onClose={() => setModal(null)} />}
      {pwOpen && (
        <div className="overlay" onClick={() => setPwOpen(false)}>
          <div className="modal small" onClick={(e) => e.stopPropagation()}>
            <ChangePassword api={api} onDone={async () => { setPwOpen(false); toast("Đã đổi mật khẩu"); }} />
          </div>
        </div>
      )}
      {toastEl}
    </AppCtx.Provider>
  );
}
