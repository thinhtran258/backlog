import { useState } from "react";
import type { Api } from "../lib/types";
import { BRAND } from "../App";

export function Login({ api, onDone }: { api: Api; onDone: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="center">
      <form className="card login" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setErr("");
        try { await api.signIn(u, p); onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
      }}>
        <h1>{BRAND}</h1>
        <label>Username<input autoFocus value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" /></label>
        <label>Mật khẩu<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" /></label>
        {err && <div className="error">{err}</div>}
        <button className="primary" disabled={busy || !u || !p}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        {api.mode === "demo" && (
          <div className="hint">
            <b>Bản demo</b> · mật khẩu mọi tài khoản: <code>demo1234</code><br />
            Thử: <code>thinh</code> (admin) · <code>an.kd</code> (thành viên nhóm Acquire) · <code>gdk</code> (chỉ xem) · <code>moi.vao</code> (lần đầu đăng nhập)
          </div>
        )}
      </form>
    </div>
  );
}

export function ChangePassword({ api, onDone, first }: { api: Api; onDone: () => void; first?: boolean }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const form = (
    <form className={first ? "card login" : ""} onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      if (p1 !== p2) { setErr("Hai mật khẩu không khớp"); return; }
      setBusy(true);
      try { await api.changePassword(p1); onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    }}>
      <h2>{first ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu"}</h2>
      {first && <p className="muted">Anh/chị cần đặt mật khẩu mới trước khi sử dụng.</p>}
      <label>Mật khẩu mới<input type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" /></label>
      <label>Nhập lại<input type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" /></label>
      <p className="muted small">Tối thiểu 8 ký tự, có cả chữ và số.</p>
      {err && <div className="error">{err}</div>}
      <button className="primary" disabled={busy || !p1}>{busy ? "Đang lưu…" : "Lưu mật khẩu"}</button>
    </form>
  );
  return first ? <div className="center">{form}</div> : form;
}
