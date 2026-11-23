# MBV Backlog — Hướng dẫn triển khai

Web app quản lý backlog và milestone cho team. Frontend dùng React (Vite), backend dùng Supabase (Postgres, Auth, Realtime, Edge Function). Hosting gợi ý: Vercel, trỏ tên miền riêng.

## Cấu trúc

```
supabase/migrations/001_schema.sql      Database, phân quyền (RLS), trigger, dữ liệu mặc định
supabase/functions/admin-users/index.ts Tạo user, reset mật khẩu, khóa/mở, đổi mật khẩu
src/                                    Giao diện
```

## Phân quyền

| Vai trò | Quyền |
|---|---|
| Admin | Toàn quyền: user, nhóm, sản phẩm, danh mục, sửa và xóa mọi item |
| Thành viên | Thêm và sửa item, milestone **trong các nhóm admin cấp**. Xem được tất cả |
| Chỉ xem | Chỉ thấy Dashboard |

- Phân quyền được kiểm tra ở **database (RLS)**, không chỉ ở giao diện.
- User đang chờ đổi mật khẩu lần đầu không đọc được dữ liệu nào.
- Không có chức năng tự đăng ký. Admin tạo user bằng username và mật khẩu tạm. User bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên (tối thiểu 8 ký tự, có chữ và số).
- Mọi thay đổi trên item và milestone được ghi vào nhật ký (ai sửa, lúc nào, sửa gì). Xem ở mục "Lịch sử" trong từng item.

## Triển khai (khoảng 30–45 phút)

### 1. Tạo project Supabase
1. Đăng ký tại supabase.com và tạo project mới. Region chọn **Southeast Asia (Singapore)**.
2. Vào **Authentication → Sign In / Providers → Email**:
   - tắt **Allow new users to sign up**
   - tắt **Confirm email**

### 2. Tạo database
Vào **SQL Editor**, dán toàn bộ nội dung `supabase/migrations/001_schema.sql` rồi bấm **Run**.

### 3. Deploy edge function
> Cách không cần cài gì: xem tài liệu hướng dẫn chi tiết (tạo function trên Dashboard). Cách dùng CLI:
Cài Supabase CLI (https://supabase.com/docs/guides/cli), sau đó chạy:
```bash
supabase login
supabase link --project-ref <PROJECT_REF>        # PROJECT_REF nằm trong URL của project
supabase secrets set LOGIN_EMAIL_DOMAIN=users.<tenmien-cua-anh>
supabase functions deploy admin-users
```
> `LOGIN_EMAIL_DOMAIN` là đuôi email nội bộ: username `thuyltm1` sẽ thành `thuyltm1@users.<tenmien>`. Không có email nào được gửi đi; đuôi này chỉ dùng để Supabase lưu tài khoản. Đuôi ở đây **phải giống** `VITE_LOGIN_EMAIL_DOMAIN` ở bước 5.

### 4. Tạo tài khoản admin đầu tiên
1. Vào **Authentication → Users → Add user → Create new user**:
   - email: `thinh@users.<tenmien>`
   - mật khẩu: tự đặt
   - tick **Auto Confirm User**
2. Vào **SQL Editor** và chạy:
```sql
insert into public.profiles (id, username, full_name, role, must_change_password)
select id, 'thinh', 'Thịnh', 'admin', false from auth.users where email = 'thinh@users.<tenmien>';
```
Từ đây trở đi, mọi user khác đều tạo trong màn **Quản trị** của app.

### 5. Deploy frontend lên Vercel
1. Đưa thư mục code lên một repo GitHub riêng tư.
2. Trên vercel.com, chọn **Add New → Project** và import repo đó. Framework chọn **Vite**.
3. Khai báo **Environment Variables** (lấy ở Supabase → Project Settings → API):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (key *publishable* `sb_publishable_...`, **không** dùng secret key)
   - `VITE_LOGIN_EMAIL_DOMAIN=users.<tenmien>`
4. Bấm **Deploy**.
5. Vào **Settings → Domains** để thêm tên miền của anh, rồi tạo bản ghi DNS (A hoặc CNAME) tại nhà cung cấp tên miền theo hướng dẫn Vercel hiển thị.
6. Quay lại Supabase, vào **Authentication → URL Configuration** và đặt **Site URL** = `https://<tenmien>`.

### 6. Cấu hình ban đầu trong app
Đăng nhập bằng `thinh`, vào **Quản trị** và lần lượt:
1. Sửa nhóm và sản phẩm theo cấu trúc CVM mới. Mã nhóm là tiền tố mã item (ví dụ ACQ-001) và không đổi được sau khi tạo.
2. Sửa danh mục KPI, nguồn yêu cầu, loại hạng mục, đối tác.
3. Tạo user, chọn vai trò và nhóm được sửa. Gửi username kèm mật khẩu tạm cho từng người.

## Chạy thử trên máy
```bash
npm install
npm run dev -- --mode demo     # bản demo, dữ liệu giả, mật khẩu demo1234
cp .env.example .env && npm run dev   # chạy với Supabase thật
```

## Lưu ý vận hành
- **Gói Free của Supabase**:
  - project bị tạm dừng nếu 7 ngày không có truy cập; dùng hằng ngày thì không bị
  - không có backup tự động lâu dài; nên tự xuất dữ liệu định kỳ (Database → Backups) hoặc nâng lên gói Pro
- **Xuất CSV** có sẵn ở màn Backlog.
- Muốn **thêm trạng thái hoặc đổi tên giai đoạn**: sửa bảng `stages` và hằng số `STAGES` trong `src/lib/types.ts`.
- Dữ liệu nằm ngoài hạ tầng MBV. Cần xác nhận với bộ phận ATTT trước khi nhập dữ liệu thật.
