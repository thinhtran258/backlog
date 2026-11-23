-- =====================================================================
-- MBV Backlog & Milestone Tracker — Supabase schema
-- Chạy toàn bộ file này 1 lần trong Supabase > SQL Editor.
-- =====================================================================

-- ---------- Bảng ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin','member','viewer')),
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.groups (
  id bigint generated always as identity primary key,
  code text not null unique check (code ~ '^[A-Z0-9]{2,6}$'),
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.products (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id),
  name text not null,
  active boolean not null default true,
  unique (group_id, name)
);

-- User thành viên được sửa item thuộc những nhóm nào
create table public.user_groups (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id bigint not null references public.groups(id) on delete cascade,
  primary key (user_id, group_id)
);

create table public.stages (
  id int primary key,
  name text not null
);
insert into public.stages (id, name) values
  (1,'Open'),(2,'Đang phân tích'),(3,'Done đề bài'),
  (4,'Đang phát triển'),(5,'Đang test'),(6,'Đã golive');

-- Danh mục chọn: KPI, nguồn yêu cầu, loại hạng mục, đối tác
create table public.lookups (
  id bigint generated always as identity primary key,
  category text not null check (category in ('kpi','source','item_type','partner')),
  value text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  unique (category, value)
);

create table public.items (
  id bigint generated always as identity primary key,
  code text unique,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  group_id bigint not null references public.groups(id),
  product_id bigint references public.products(id),
  priority text not null default 'P1' check (priority in ('P0','P1','P2')),
  kpi text,
  kpi_target text,
  source text,
  item_type text,
  partner text,
  pic_kd uuid references public.profiles(id),
  pic_gp uuid references public.profiles(id),
  link_pyc text,
  link_figma text,
  it_ticket text,
  hard_deadline date,
  status int not null default 1 references public.stages(id), -- tự suy ra từ milestone
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id bigint generated always as identity primary key,
  item_id bigint not null references public.items(id) on delete cascade,
  stage_id int not null references public.stages(id) check (stage_id between 2 and 6),
  planned_date date,
  done_at date,
  note text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (item_id, stage_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id bigint not null,
  item_id bigint,
  action text not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);
create index on public.audit_log (item_id, changed_at desc);
create index on public.milestones (item_id);
create index on public.items (group_id);

-- ---------- Hàm phân quyền ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles
  where id = auth.uid() and active and not must_change_password
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.can_edit_group(gid bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.my_role() = 'member'
          and exists (select 1 from user_groups where user_id = auth.uid() and group_id = gid))
$$;

-- ---------- Trigger: mã item, milestone, trạng thái, audit ----------
create or replace function public.items_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare g text; n int;
begin
  perform pg_advisory_xact_lock(new.group_id);
  select code into g from groups where id = new.group_id;
  select coalesce(max(substring(code from '(\d+)$')::int), 0) + 1 into n
    from items where code like g || '-%';
  new.code := g || '-' || lpad(n::text, 3, '0');
  new.status := 1;
  new.created_at := now();
  new.updated_at := now();
  return new;
end $$;

create or replace function public.items_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Không cho sửa tay mã và trạng thái
  new.code := old.code;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if new.status is distinct from old.status
     and coalesce(current_setting('app.deriving', true), '') <> '1' then
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.items_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into milestones (item_id, stage_id, updated_by)
  select new.id, s, auth.uid() from generate_series(2, 6) s;
  return null;
end $$;

create or replace function public.milestones_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  new.item_id := old.item_id;
  new.stage_id := old.stage_id;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;

create or replace function public.derive_item_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare iid bigint := coalesce(new.item_id, old.item_id);
begin
  perform set_config('app.deriving', '1', true);
  update items set status = coalesce(
    (select max(stage_id) from milestones where item_id = iid and done_at is not null), 1)
  where id = iid;
  perform set_config('app.deriving', '0', true);
  return null;
end $$;

create or replace function public.audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (o - 'updated_at' - 'updated_by' - 'status') = (n - 'updated_at' - 'updated_by' - 'status') then
    return null; -- bỏ qua thay đổi không có nội dung
  end if;
  insert into audit_log (table_name, row_id, item_id, action, changed_by, old_data, new_data)
  values (tg_table_name,
          coalesce((n->>'id')::bigint, (o->>'id')::bigint),
          case when tg_table_name = 'items' then coalesce((n->>'id')::bigint, (o->>'id')::bigint)
               else coalesce((n->>'item_id')::bigint, (o->>'item_id')::bigint) end,
          tg_op, auth.uid(), o, n);
  return null;
end $$;

create trigger items_bi before insert on public.items for each row execute function public.items_before_insert();
create trigger items_bu before update on public.items for each row execute function public.items_before_update();
create trigger items_ai after insert on public.items for each row execute function public.items_after_insert();
create trigger items_audit after insert or update or delete on public.items for each row execute function public.audit();
create trigger ms_bu before update on public.milestones for each row execute function public.milestones_before_update();
create trigger ms_status after update of done_at on public.milestones for each row execute function public.derive_item_status();
create trigger ms_audit after update on public.milestones for each row execute function public.audit();

-- ---------- Row Level Security ----------
alter table public.profiles    enable row level security;
alter table public.groups      enable row level security;
alter table public.products    enable row level security;
alter table public.user_groups enable row level security;
alter table public.stages      enable row level security;
alter table public.lookups     enable row level security;
alter table public.items       enable row level security;
alter table public.milestones  enable row level security;
alter table public.audit_log   enable row level security;

-- Đọc: user đang hoạt động (đã đổi mật khẩu lần đầu). Hồ sơ của chính mình luôn đọc được.
create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_active_user());
create policy profiles_admin on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create policy groups_read on public.groups for select using (public.is_active_user());
create policy groups_admin on public.groups for all using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (public.is_active_user());
create policy products_admin on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy ug_read on public.user_groups for select using (public.is_active_user());
create policy ug_admin on public.user_groups for all using (public.is_admin()) with check (public.is_admin());

create policy stages_read on public.stages for select using (public.is_active_user());

create policy lookups_read on public.lookups for select using (public.is_active_user());
create policy lookups_admin on public.lookups for all using (public.is_admin()) with check (public.is_admin());

create policy items_read on public.items for select using (public.is_active_user());
create policy items_insert on public.items for insert with check (public.can_edit_group(group_id));
create policy items_update on public.items for update
  using (public.can_edit_group(group_id)) with check (public.can_edit_group(group_id));
create policy items_delete on public.items for delete using (public.is_admin());

create policy ms_read on public.milestones for select using (public.is_active_user());
create policy ms_update on public.milestones for update
  using (exists (select 1 from public.items i where i.id = item_id and public.can_edit_group(i.group_id)))
  with check (exists (select 1 from public.items i where i.id = item_id and public.can_edit_group(i.group_id)));

-- Lịch sử: mọi user hoạt động được xem
create policy audit_read on public.audit_log for select using (public.is_active_user());

-- ---------- Realtime ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.items, public.milestones;
  end if;
end $$;

-- ---------- Dữ liệu mặc định (sửa được trong màn Quản trị) ----------
insert into public.groups (code, name, sort_order) values
  ('ACQ','Acquire',1),('RET','Retention/Upsale',2),('UX','Tiện ích/Trải nghiệm',3),
  ('OPS','Vận hành/Tuân thủ',4),('CD','CD',5);
insert into public.products (group_id, name)
  select id, 'Sinh lời tự động' from public.groups where code = 'CD';
insert into public.lookups (category, value, sort_order) values
  ('kpi','Activation',1),('kpi','CASA',2),('kpi','KH đối tác về app',3),('kpi','Retention',4),
  ('source','GĐ Khối',1),('source','Chủ tịch',2),('source','Đối tác',3),('source','Tuân thủ/NHNN',4),('source','Nội bộ',5),
  ('item_type','Tính năng mới',1),('item_type','Cải tiến',2),('item_type','Sửa lỗi',3),('item_type','Tuân thủ bắt buộc',4),
  ('partner','MoMo',1),('partner','VDS',2),('partner','KiotViet',3),('partner','Viettel',4),('partner','DNSE',5);
