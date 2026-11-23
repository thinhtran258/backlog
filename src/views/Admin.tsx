import { useState } from "react";
import { useApp } from "../App";
import type { LookupCategory, Profile, Role } from "../lib/types";
import { genPassword } from "../lib/util";

const ROLE_LABEL: Record<Role, string> = { admin: "Admin", member: "Thành viên", viewer: "Chỉ xem" };

export function Admin() {
  const [tab, setTab] = useState<"users" | "groups" | "lookups">("users");
  return (
    <div className="page">
      <div className="toolbar">
        <h1>Quản trị</h1>
        <div className="seg-tabs">
          <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>Người dùng</button>
          <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>Nhóm & sản phẩm</button>
          <button className={tab === "lookups" ? "active" : ""} onClick={() => setTab("lookups")}>Danh mục</button>
        </div>
      </div>
      {tab === "users" && <Users />}
      {tab === "groups" && <Groups />}
      {tab === "lookups" && <Lookups />}
    </div>
  );
}

function GroupChecks({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const { s } = useApp();
  return (
    <div className="chips">
      {s.groups.filter((g) => g.active).map((g) => (
        <label key={g.id} className={"chip" + (value.includes(g.id) ? " on" : "")}>
          <input type="checkbox" checked={value.includes(g.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, g.id] : value.filter((x) => x !== g.id))} />
          {g.name}
        </label>
      ))}
    </div>
  );
}

function Users() {
  const { s, api, run } = useApp();
  const [form, setForm] = useState({ username: "", full_name: "", role: "member" as Role, password: genPassword(), group_ids: [] as number[] });
  const [created, setCreated] = useState<{ u: string; p: string } | null>(null);
  const [edit, setEdit] = useState<Profile | null>(null);
  const [editGroups, setEditGroups] = useState<number[]>([]);
  const [reset, setReset] = useState<{ u: string; p: string } | null>(null);
  const groupsOf = (uid: string) => s.userGroups.filter((x) => x.user_id === uid).map((x) => x.group_id);

  const create = async () => {
    const f = { ...form, username: form.username.trim().toLowerCase() };
    if (await run(() => api.createUser(f), "Đã tạo user")) {
      setCreated({ u: f.username, p: f.password });
      setForm({ username: "", full_name: "", role: "member", password: genPassword(), group_ids: [] });
    }
  };

  return (
    <>
      <section className="card">
        <h2>Tạo user</h2>
        <div className="form inline">
          <label>Username<input value={form.username} placeholder="vd: thuyltm1" onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Họ tên<input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          <label>Vai trò
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>Mật khẩu tạm<span className="row"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" onClick={() => setForm({ ...form, password: genPassword() })}>↻</button></span></label>
        </div>
        {form.role === "member" && <><p className="muted small">Được sửa item thuộc nhóm:</p><GroupChecks value={form.group_ids} onChange={(g) => setForm({ ...form, group_ids: g })} /></>}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="primary" disabled={!form.username || form.password.length < 8} onClick={create}>Tạo user</button>
          {created && <span className="okbox">Gửi cho user: <b>{created.u}</b> / <code>{created.p}</code> — sẽ phải đổi mật khẩu khi đăng nhập lần đầu.</span>}
        </div>
      </section>

      {reset && <div className="okbox">Mật khẩu tạm mới của <b>{reset.u}</b>: <code>{reset.p}</code> (user phải đổi khi đăng nhập) <button className="link" onClick={() => setReset(null)}>✕</button></div>}

      <table className="grid">
        <thead><tr><th>Username</th><th>Họ tên</th><th>Vai trò</th><th>Nhóm được sửa</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>
          {s.profiles.map((p) => edit?.id === p.id ? (
            <tr key={p.id} className="editing">
              <td className="mono">{p.username}</td>
              <td><input value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} /></td>
              <td>
                <select value={edit.role} disabled={p.id === s.me.id} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role })}>
                  {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td>{edit.role === "member" ? <GroupChecks value={editGroups} onChange={setEditGroups} /> : <span className="muted">{edit.role === "admin" ? "Tất cả" : "—"}</span>}</td>
              <td />
              <td className="nowrap">
                <button className="primary" onClick={async () => {
                  const ok = await run(async () => {
                    await api.updateProfile(p.id, { full_name: edit.full_name, role: edit.role });
                    await api.setUserGroups(p.id, edit.role === "member" ? editGroups : []);
                  }, "Đã lưu");
                  if (ok) setEdit(null);
                }}>Lưu</button>
                <button onClick={() => setEdit(null)}>Hủy</button>
              </td>
            </tr>
          ) : (
            <tr key={p.id} className={p.active ? "" : "inactive"}>
              <td className="mono">{p.username}</td>
              <td>{p.full_name}</td>
              <td>{ROLE_LABEL[p.role]}</td>
              <td>{p.role === "admin" ? <span className="muted">Tất cả</span> : groupsOf(p.id).map((g) => s.groups.find((x) => x.id === g)?.name).join(", ") || <span className="muted">—</span>}</td>
              <td>{!p.active ? <span className="late">Đã khóa</span> : p.must_change_password ? <span className="due">Chờ đổi mật khẩu</span> : "Hoạt động"}</td>
              <td className="nowrap">
                <button className="link" onClick={() => { setEdit(p); setEditGroups(groupsOf(p.id)); }}>Sửa</button>
                <button className="link" onClick={async () => { const pw = genPassword(); if (await run(() => api.resetPassword(p.id, pw), "Đã reset")) setReset({ u: p.username, p: pw }); }}>Reset MK</button>
                {p.id !== s.me.id && <button className="link" onClick={() => run(() => api.setActive(p.id, !p.active), p.active ? "Đã khóa" : "Đã mở khóa")}>{p.active ? "Khóa" : "Mở khóa"}</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Groups() {
  const { s, api, run } = useApp();
  const [ng, setNg] = useState({ code: "", name: "" });
  const [np, setNp] = useState<Record<number, string>>({});
  return (
    <>
      <section className="card">
        <h2>Thêm nhóm</h2>
        <div className="row">
          <input placeholder="Mã (2–6 ký tự, vd ACQ)" value={ng.code} onChange={(e) => setNg({ ...ng, code: e.target.value.toUpperCase() })} style={{ width: 170 }} />
          <input placeholder="Tên nhóm" value={ng.name} onChange={(e) => setNg({ ...ng, name: e.target.value })} />
          <button className="primary" disabled={!/^[A-Z0-9]{2,6}$/.test(ng.code) || !ng.name}
            onClick={async () => { if (await run(() => api.saveGroup({ ...ng, sort_order: s.groups.length + 1 }), "Đã thêm nhóm")) setNg({ code: "", name: "" }); }}>Thêm</button>
        </div>
        <p className="muted small">Mã nhóm dùng làm tiền tố mã item (ACQ-001) và không đổi được sau khi tạo.</p>
      </section>
      {s.groups.map((g) => (
        <section key={g.id} className={"card" + (g.active ? "" : " inactive")}>
          <div className="row">
            <span className="mono">{g.code}</span>
            <input defaultValue={g.name} onBlur={(e) => e.target.value !== g.name && run(() => api.saveGroup({ id: g.id, name: e.target.value }), "Đã đổi tên")} />
            <label className="small">Thứ tự <input type="number" defaultValue={g.sort_order} style={{ width: 60 }}
              onBlur={(e) => Number(e.target.value) !== g.sort_order && run(() => api.saveGroup({ id: g.id, sort_order: Number(e.target.value) }))} /></label>
            <button className="link" onClick={() => run(() => api.saveGroup({ id: g.id, active: !g.active }))}>{g.active ? "Ẩn nhóm" : "Hiện lại"}</button>
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {s.products.filter((p) => p.group_id === g.id).map((p) => (
              <span key={p.id} className={"chip" + (p.active ? " on" : " off")}>
                {p.name} <button className="link" title={p.active ? "Ẩn" : "Hiện"} onClick={() => run(() => api.saveProduct({ id: p.id, active: !p.active }))}>{p.active ? "✕" : "↺"}</button>
              </span>
            ))}
            <input placeholder="+ sản phẩm" value={np[g.id] ?? ""} onChange={(e) => setNp({ ...np, [g.id]: e.target.value })} style={{ width: 160 }}
              onKeyDown={async (e) => { if (e.key === "Enter" && np[g.id]?.trim() && await run(() => api.saveProduct({ group_id: g.id, name: np[g.id].trim() }), "Đã thêm sản phẩm")) setNp({ ...np, [g.id]: "" }); }} />
          </div>
        </section>
      ))}
    </>
  );
}

const CATS: { id: LookupCategory; label: string }[] = [
  { id: "kpi", label: "KPI" }, { id: "source", label: "Nguồn yêu cầu" }, { id: "item_type", label: "Loại hạng mục" }, { id: "partner", label: "Đối tác" },
];

function Lookups() {
  const { s, api, run } = useApp();
  const [nv, setNv] = useState<Record<string, string>>({});
  return (
    <div className="two">
      {CATS.map((c) => (
        <section key={c.id} className="card">
          <h2>{c.label}</h2>
          <div className="chips">
            {s.lookups.filter((l) => l.category === c.id).map((l) => (
              <span key={l.id} className={"chip" + (l.active ? " on" : " off")}>
                {l.value} <button className="link" onClick={() => run(() => api.saveLookup({ id: l.id, active: !l.active }))}>{l.active ? "✕" : "↺"}</button>
              </span>
            ))}
          </div>
          <input placeholder="+ thêm, Enter để lưu" value={nv[c.id] ?? ""} style={{ marginTop: 8 }} onChange={(e) => setNv({ ...nv, [c.id]: e.target.value })}
            onKeyDown={async (e) => { if (e.key === "Enter" && nv[c.id]?.trim() && await run(() => api.saveLookup({ category: c.id, value: nv[c.id].trim() }), "Đã thêm")) setNv({ ...nv, [c.id]: "" }); }} />
        </section>
      ))}
    </div>
  );
}
