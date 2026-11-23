import { createClient, FunctionsHttpError } from "@supabase/supabase-js";
import type { Api, ItemDraft, MilestonePatch, Snapshot, Profile } from "./types";

export function createSupabaseApi(): Api {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
  const domain = import.meta.env.VITE_LOGIN_EMAIL_DOMAIN as string;
  if (!url || !key || !domain) throw new Error("Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / VITE_LOGIN_EMAIL_DOMAIN trong .env");
  const sb = createClient(url, key);

  const must = <T,>(r: { data: T; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };

  async function fn(body: Record<string, unknown>) {
    const { error } = await sb.functions.invoke("admin-users", { body });
    if (error) {
      if (error instanceof FunctionsHttpError) {
        const j = await error.context.json().catch(() => null);
        throw new Error(j?.error ?? error.message);
      }
      throw new Error(error.message);
    }
  }

  return {
    mode: "supabase",
    async currentUserId() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.id ?? null;
    },
    async signIn(username, password) {
      const email = `${username.trim().toLowerCase()}@${domain}`;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message.includes("Invalid") ? "Sai username hoặc mật khẩu" : error.message);
    },
    async signOut() { await sb.auth.signOut(); },

    async loadAll(): Promise<Snapshot> {
      const uid = (await sb.auth.getSession()).data.session?.user.id;
      if (!uid) throw new Error("Chưa đăng nhập");
      const [profiles, groups, products, userGroups, lookups, items, milestones] = await Promise.all([
        sb.from("profiles").select("*").order("username"),
        sb.from("groups").select("*").order("sort_order"),
        sb.from("products").select("*").order("name"),
        sb.from("user_groups").select("*"),
        sb.from("lookups").select("*").order("sort_order"),
        sb.from("items").select("*").order("id"),
        sb.from("milestones").select("*"),
      ]);
      const ps = must(profiles) as Profile[];
      const me = ps.find((p) => p.id === uid);
      if (!me) throw new Error("Tài khoản chưa được cấp hồ sơ. Liên hệ admin.");
      return {
        me, profiles: ps,
        groups: must(groups) ?? [], products: must(products) ?? [], userGroups: must(userGroups) ?? [],
        lookups: must(lookups) ?? [], items: must(items) ?? [], milestones: must(milestones) ?? [],
      };
    },

    async saveItem(draft: ItemDraft, plans?: Record<number, MilestonePatch>) {
      const { id, ...rest } = draft;
      if (id) {
        must(await sb.from("items").update(rest).eq("id", id));
        return;
      }
      const created = must(await sb.from("items").insert(rest).select("id").single()) as { id: number };
      if (plans) {
        for (const [stage, patch] of Object.entries(plans)) {
          if (!patch.planned_date && !patch.note && !patch.done_at) continue;
          must(await sb.from("milestones").update(patch).eq("item_id", created.id).eq("stage_id", Number(stage)));
        }
      }
    },
    async deleteItem(id) { must(await sb.from("items").delete().eq("id", id)); },
    async saveMilestone(id, patch) { must(await sb.from("milestones").update(patch).eq("id", id)); },
    async itemHistory(itemId) {
      return must(await sb.from("audit_log").select("*").eq("item_id", itemId).order("changed_at", { ascending: false }).limit(100)) ?? [];
    },

    changePassword: (password) => fn({ action: "change_password", password }),
    createUser: (u) => fn({ action: "create_user", ...u }),
    resetPassword: (user_id, password) => fn({ action: "reset_password", user_id, password }),
    setActive: (user_id, active) => fn({ action: "set_active", user_id, active }),
    async updateProfile(userId, patch) { must(await sb.from("profiles").update(patch).eq("id", userId)); },
    async setUserGroups(userId, groupIds) {
      must(await sb.from("user_groups").delete().eq("user_id", userId));
      if (groupIds.length) must(await sb.from("user_groups").insert(groupIds.map((g) => ({ user_id: userId, group_id: g }))));
    },
    async saveGroup(g) {
      const { id, ...rest } = g;
      must(id ? await sb.from("groups").update(rest).eq("id", id) : await sb.from("groups").insert(rest));
    },
    async saveProduct(p) {
      const { id, ...rest } = p;
      must(id ? await sb.from("products").update(rest).eq("id", id) : await sb.from("products").insert(rest));
    },
    async saveLookup(l) {
      const { id, ...rest } = l;
      must(id ? await sb.from("lookups").update(rest).eq("id", id) : await sb.from("lookups").insert(rest));
    },

    subscribe(onChange) {
      let t: ReturnType<typeof setTimeout> | undefined;
      const debounced = () => { clearTimeout(t); t = setTimeout(onChange, 400); };
      const ch = sb.channel("backlog-changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "items" }, debounced)
        .on("postgres_changes", { event: "*", schema: "public", table: "milestones" }, debounced)
        .subscribe();
      return () => { clearTimeout(t); sb.removeChannel(ch); };
    },
  };
}
