// Supabase Edge Function: quản trị user (tạo, reset mật khẩu, khóa/mở) + đổi mật khẩu của chính mình.
// Deploy: Supabase Dashboard > Edge Functions > Deploy a new function > Via Editor (tên: admin-users)
// Tắt "Verify JWT" của function này: code tự kiểm tra người gọi bằng auth.getUser().
// Biến môi trường cần set: LOGIN_EMAIL_DOMAIN (phải giống VITE_LOGIN_EMAIL_DOMAIN ở frontend)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const ROLES = ["admin", "member", "viewer"];

function checkPassword(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "Mật khẩu tối thiểu 8 ký tự";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Mật khẩu phải có cả chữ và số";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Ưu tiên secret key mới (sb_secret_...), fallback key cũ service_role
  let secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try { secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? secret; } catch { /* dùng key cũ */ }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const domain = Deno.env.get("LOGIN_EMAIL_DOMAIN");
  if (!domain) return json({ error: "Chưa cấu hình LOGIN_EMAIL_DOMAIN" }, 500);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: authData } = await admin.auth.getUser(jwt);
  const caller = authData?.user;
  if (!caller) return json({ error: "Chưa đăng nhập" }, 401);

  const { data: me } = await admin.from("profiles").select("*").eq("id", caller.id).maybeSingle();
  if (!me || !me.active) return json({ error: "Tài khoản không hoạt động" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Body không hợp lệ" }, 400); }

  // ---- Ai cũng được: đổi mật khẩu của chính mình ----
  if (body.action === "change_password") {
    const err = checkPassword(body.password);
    if (err) return json({ error: err }, 400);
    const { error } = await admin.auth.admin.updateUserById(caller.id, { password: body.password as string });
    if (error) return json({ error: error.message }, 400);
    await admin.from("profiles").update({ must_change_password: false }).eq("id", caller.id);
    return json({ ok: true });
  }

  // ---- Chỉ admin ----
  if (me.role !== "admin" || me.must_change_password) return json({ error: "Không có quyền" }, 403);

  switch (body.action) {
    case "create_user": {
      const username = String(body.username ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const role = String(body.role ?? "member");
      const groupIds = Array.isArray(body.group_ids) ? body.group_ids.map(Number) : [];
      if (!USERNAME_RE.test(username)) return json({ error: "Username 3–32 ký tự: a-z, 0-9, . _ -" }, 400);
      if (!ROLES.includes(role)) return json({ error: "Vai trò không hợp lệ" }, 400);
      const err = checkPassword(body.password);
      if (err) return json({ error: err }, 400);

      const { data: created, error } = await admin.auth.admin.createUser({
        email: `${username}@${domain}`,
        password: body.password as string,
        email_confirm: true,
        user_metadata: { username },
      });
      if (error || !created.user) {
        const msg = error?.message?.includes("already") ? "Username đã tồn tại" : error?.message;
        return json({ error: msg ?? "Không tạo được user" }, 400);
      }
      const id = created.user.id;
      const { error: pErr } = await admin.from("profiles").insert({
        id, username, full_name: fullName, role, must_change_password: true, active: true,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(id);
        return json({ error: pErr.message }, 400);
      }
      if (groupIds.length) {
        await admin.from("user_groups").insert(groupIds.map((g) => ({ user_id: id, group_id: g })));
      }
      return json({ ok: true, id });
    }

    case "reset_password": {
      const userId = String(body.user_id ?? "");
      const err = checkPassword(body.password);
      if (err) return json({ error: err }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password as string });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
      return json({ ok: true });
    }

    case "set_active": {
      const userId = String(body.user_id ?? "");
      const active = Boolean(body.active);
      if (userId === caller.id) return json({ error: "Không thể tự khóa chính mình" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ active }).eq("id", userId);
      return json({ ok: true });
    }

    default:
      return json({ error: "Action không hợp lệ" }, 400);
  }
});
