# Multi-Seller Marketplace Migration — Execution Plan

Dokumen ini adalah instruksi kerja untuk AI coding agent (Cursor). Ikuti aturan di
bagian **Global Rules** secara ketat. Kerjakan **satu phase pada satu waktu**,
berhenti setelah tiap phase selesai, dan tunggu konfirmasi eksplisit dari saya
sebelum lanjut ke phase berikutnya — jangan asumsikan "lanjut otomatis".

---

## 0. Environment Context

- Stack: Next.js/React (sesuaikan bila beda) + Supabase (Postgres + Auth + Storage)
- Branch kerja: `evolve/multi-seller` — JANGAN commit atau push ke `main`
- Target database untuk migration: **project Supabase kedua (dev/staging)**,
  BUKAN project production. Jika kredensial/connection string tidak eksplisit
  diberikan di environment, JANGAN mencoba menjalankan migration ke database
  manapun — cukup generate file migration-nya saja dan berhenti.
- Semua perubahan skema HARUS berupa file baru di `supabase/migrations/`,
  format nama: `NNNN_deskripsi_singkat.sql` (contoh: `0001_seller_foundation.sql`)
- Jangan pernah menjalankan `supabase db push`, `supabase db reset`, atau
  perintah apapun yang menyentuh database secara langsung tanpa saya minta
  eksplisit di pesan terpisah.

---

## 1. Current Schema (Source of Truth)

Ini adalah skema yang SEDANG BERJALAN di production. Jangan berasumsi ada
kolom/tabel di luar yang tercantum di sini. Jika butuh sesuatu yang belum ada,
tambahkan lewat migration baru (additive), jangan modifikasi definisi ini secara
langsung.

```sql
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  profile_img text,
  role USER-DEFINED NOT NULL DEFAULT 'user'::user_role,
  created_at timestamp with time zone DEFAULT now(),
  email text UNIQUE,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.cart (
  id uuid NOT NULL,
  profile_id uuid NOT NULL UNIQUE,
  CONSTRAINT cart_pkey PRIMARY KEY (id),
  CONSTRAINT cart_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.products (
  slug text UNIQUE,
  name text NOT NULL,
  description text NOT NULL,
  id bigint NOT NULL DEFAULT nextval('products_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  file_url text,
  price integer DEFAULT 1,
  CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.cart_items (
  cart_id uuid NOT NULL,
  product_id bigint NOT NULL,
  id bigint NOT NULL DEFAULT nextval('cart_items_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.cart(id),
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.product_images (
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL,
  CONSTRAINT product_images_pkey PRIMARY KEY (id),
  CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.categories (
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  id bigint NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_categories (
  product_id bigint,
  category_id bigint,
  id bigint NOT NULL DEFAULT nextval('product_categories_id_seq'::regclass),
  CONSTRAINT product_categories_pkey PRIMARY KEY (id),
  CONSTRAINT product_categories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.reviews (
  product_id bigint,
  profile_id uuid,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT reviews_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.wishlists (
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wishlists_pkey PRIMARY KEY (id),
  CONSTRAINT fk_wishlist_profile FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.orders (
  payment_url text,
  snap_token text,
  snap_redirect_url text,
  profile_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE,
  total_amount integer NOT NULL,
  payment_method text,
  midtrans_order_id text UNIQUE,
  midtrans_transaction_id text UNIQUE,
  paid_at timestamp with time zone,
  expired_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text, 'cancelled'::text, 'refunded'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  order_id uuid NOT NULL,
  product_id bigint NOT NULL,
  price integer NOT NULL,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.user_products (
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  order_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_products_pkey PRIMARY KEY (id),
  CONSTRAINT user_products_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT user_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT user_products_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.payments (
  provider text,
  provider_invoice_id text UNIQUE,
  payment_method text,
  status text,
  paid_at timestamp with time zone,
  order_id uuid NOT NULL,
  midtrans_transaction_id text,
  payment_type text,
  gross_amount integer,
  transaction_status text,
  fraud_status text,
  raw_response jsonb,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
CREATE TABLE public.download_logs (
  profile_id uuid NOT NULL,
  product_id bigint NOT NULL,
  ip_address inet,
  user_agent text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  downloaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT download_logs_pkey PRIMARY KEY (id),
  CONSTRAINT download_logs_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT download_logs_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.coupons (
  code text NOT NULL UNIQUE,
  discount integer NOT NULL,
  expired_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  max_usage integer DEFAULT 1,
  used_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_files (
  product_id bigint NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  version text DEFAULT '1.0.0'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_files_pkey PRIMARY KEY (id),
  CONSTRAINT product_files_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.coupon_usages (
  coupon_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  order_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  used_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usages_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id),
  CONSTRAINT coupon_usages_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id)
);
```

> Catatan penting: kolom `profiles.role` bertipe custom enum `user_role`
> (bukan `text` biasa). Nilai default-nya `'user'`. JANGAN mengubah tipe kolom
> ini secara langsung. Status "seller atau bukan" TIDAK disimpan di kolom ini
> — lihat Section 3 di bawah, keberadaan row di tabel `sellers` yang menentukan
> status seller seseorang.

---

## 2. Global Rules — WAJIB DIIKUTI DI SEMUA PHASE

1. **Additive only.** Tidak boleh ada `DROP TABLE`, `DROP COLUMN`, `RENAME`,
   atau perubahan tipe data pada objek yang sudah ada di Section 1.
2. **Kolom baru pada tabel existing wajib salah satu dari:** `NULL`-able,
   atau punya `DEFAULT` yang aman — supaya tidak breaking terhadap baris lama
   maupun kode aplikasi lama yang belum tahu kolom ini.
3. **Satu migration file per phase.** Jangan gabung beberapa phase dalam satu
   file.
4. **Setiap migration file wajib diberi komentar header** menjelaskan tujuan,
   phase, dan tanggal.
5. **Row Level Security (RLS) wajib diaktifkan** untuk setiap tabel baru yang
   menyimpan data milik user/seller tertentu (`sellers`, `seller_payouts`,
   `seller_payout_items`). Jangan biarkan tabel baru tanpa RLS.
6. **Tidak boleh generate seed data / dummy data langsung ke database dev**
   tanpa diminta eksplisit.
7. **Berhenti setelah tiap phase.** Tampilkan ringkasan apa yang dibuat +
   file migration-nya, lalu tunggu saya bilang "lanjut phase berikutnya".
8. **Jika ada ambiguitas** (misal nama kolom, tipe data, dsb yang tidak
   dijelaskan di dokumen ini), TANYAKAN dulu — jangan menebak dan langsung
   generate.
9. **Jangan menjalankan migration ke database manapun** (`supabase db push`,
   dsb) kecuali diminta eksplisit dalam pesan terpisah di luar dokumen ini.

### Larangan Eksplisit (Do NOT)
- Jangan ubah `profiles.role` enum atau constraint-nya.
- Jangan ubah struktur `orders.status` CHECK constraint.
- Jangan hapus/ubah relasi FK yang sudah ada di Section 1.
- Jangan install package/library baru tanpa menyebutkan alasan di ringkasan
  akhir phase.
- Jangan menyentuh branch `main` atau project Supabase production.

---

## 3. Requirement Baru: Pemisahan Alur Login/Onboarding (Seller vs Buyer)

Ini requirement fungsional tambahan di luar skema murni — pastikan Cursor
paham konteksnya sebelum Phase 1 dikerjakan.

### Perilaku yang Diinginkan
- Proses **auth (login/signup) tetap satu jalur** — tidak dipisah jadi dua
  sistem auth berbeda. Semua orang tetap signup lewat Supabase Auth seperti
  biasa, dan otomatis punya row di `profiles`.
- Yang dipisah adalah **onboarding setelah signup**:
  - Saat pertama kali signup (atau lewat halaman "Buka toko" kapan saja
    setelahnya), user diberi pilihan:
    - **"Daftar sebagai Pembeli"** → tidak ada aksi tambahan, user langsung
      diarahkan ke halaman publik/marketplace seperti biasa. TIDAK ada row
      baru dibuat di tabel `sellers`.
    - **"Daftar sebagai Seller"** → user WAJIB mengisi minimal `store_name`
      (dan sistem generate `store_slug` otomatis dari nama, unique). Setelah
      submit, dibuatkan row baru di tabel `sellers` dengan `status = 'pending'`
      (butuh approval admin platform sebelum boleh jualan — lihat Phase 1).
- **Status seller seseorang ditentukan oleh keberadaan row miliknya di tabel
  `sellers`**, bukan oleh kolom baru di `profiles`. Satu `profile_id` hanya
  boleh punya maksimal satu row `sellers` (unique constraint).
- Seseorang yang sudah jadi buyer biasa tetap bisa "upgrade" jadi seller kapan
  saja lewat halaman terpisah (misal `/become-seller`), tanpa perlu signup
  ulang atau bikin akun baru.
- Halaman/route yang perlu dipisahkan secara UI (detail implementasi di
  Phase 6, ini baru gambaran):
  - `/become-seller` — form isi nama toko, hanya muncul kalau user belum
    punya row di `sellers`
  - `/seller/*` — dashboard seller, hanya bisa diakses kalau user punya row
    `sellers` dengan `status = 'approved'`
  - Halaman publik/marketplace — tetap bisa diakses semua orang termasuk yang
    belum login

### Kenapa Bukan Kolom di `profiles`
Sengaja dipisah ke tabel `sellers` (bukan menambah value baru ke enum
`user_role` atau kolom `is_seller` di `profiles`) supaya:
- `sellers` bisa menyimpan data yang tidak relevan untuk buyer (nama toko,
  rekening bank, komisi, status approval) tanpa bikin tabel `profiles` gemuk
- Approval flow (`pending` → `approved`/`rejected`) lebih natural sebagai
  baris terpisah, bukan status di kolom enum yang sudah dipakai untuk hal lain
  (admin/user)

---

## 4. Phase Breakdown

### Phase 1 — Seller Foundation & Onboarding
**Tujuan:** bikin entitas seller, belum menyentuh tabel `products`/`orders`
sama sekali.

Buat tabel baru:
```sql
CREATE TABLE public.sellers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  store_name text NOT NULL,
  store_slug text NOT NULL UNIQUE,
  store_description text,
  bank_account text,
  bank_name text,
  commission_rate numeric NOT NULL DEFAULT 0.10,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text,'approved'::text,'suspended'::text,'rejected'::text])),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sellers_pkey PRIMARY KEY (id),
  CONSTRAINT sellers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
```

RLS yang wajib dibuat:
- Seller bisa `SELECT`/`UPDATE` row miliknya sendiri (`profile_id = auth.uid()`)
- Siapapun (public, termasuk anon) bisa `SELECT` row dengan `status = 'approved'`
  (untuk halaman toko publik)
- Hanya admin (`profiles.role = 'admin'`) yang bisa `UPDATE status`
- Insert hanya boleh oleh user untuk `profile_id = auth.uid()` miliknya sendiri,
  dan hanya jika belum punya row lain (unique constraint sudah handle ini di
  level DB, tapi policy insert tetap perlu ada)

**Tidak boleh dikerjakan di phase ini:** apapun yang menyentuh `products`,
`orders`, `order_items`.

**Acceptance criteria:**
- [ ] Migration file `0001_seller_foundation.sql` dibuat
- [ ] Insert row sellers dari user A berhasil, dari user A lagi (duplikat) gagal
  karena unique constraint
- [ ] User B tidak bisa `SELECT`/`UPDATE` row seller milik user A yang statusnya
    masih `pending`
- [ ] Anon/public bisa `SELECT` row seller yang `status = 'approved'`

---

### Phase 2 — Product Ownership
**Tujuan:** produk punya pemilik seller, produk lama tetap tampil normal.

```sql
ALTER TABLE public.products
  ADD COLUMN seller_id uuid NULL REFERENCES public.sellers(id),
  ADD COLUMN status text NOT NULL DEFAULT 'published'
    CHECK (status = ANY (ARRAY['draft'::text,'pending_review'::text,'published'::text,'rejected'::text,'suspended'::text]));
```

Catatan: `seller_id` nullable dan default `status = 'published'` sengaja
dipilih supaya SEMUA produk lama (yang dibuat sebelum fitur ini ada) otomatis
dianggap valid dan tetap tampil tanpa perlu migrasi data manual. `seller_id
NULL` = produk milik platform langsung (bukan milik seller manapun).

**Tidak boleh dikerjakan di phase ini:** ubah `order_items`, buat tabel payout.

**Acceptance criteria:**
- [ ] Migration file `0002_product_ownership.sql` dibuat
- [ ] Query lama `SELECT * FROM products` tetap return semua row tanpa error
- [ ] Produk baru bisa diinsert dengan `seller_id` terisi maupun `NULL`
- [ ] RLS: seller hanya bisa `INSERT`/`UPDATE` produk dengan `seller_id`
      miliknya sendiri, dan hanya jika `sellers.status = 'approved'`

---

### Phase 3 — Order & Commission Attribution
**Tujuan:** `order_items` tahu produk itu milik seller siapa, dan berapa
komisi platform vs earning seller.

```sql
ALTER TABLE public.order_items
  ADD COLUMN seller_id uuid NULL REFERENCES public.sellers(id),
  ADD COLUMN commission_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN seller_earning integer NOT NULL DEFAULT 0,
  ADD COLUMN payout_status text NOT NULL DEFAULT 'pending'
    CHECK (payout_status = ANY (ARRAY['pending'::text,'held'::text,'released'::text,'refunded'::text]));
```

Logika pengisian `seller_id`, `commission_amount`, `seller_earning` di
`order_items` dilakukan di **application layer / server function saat order
dibuat** (bukan trigger DB), berdasarkan `products.seller_id` dan
`sellers.commission_rate` pada saat itu. Jelaskan ini di komentar migration,
tapi jangan tulis trigger di phase ini kecuali diminta terpisah.

**Acceptance criteria:**
- [ ] Migration file `0003_order_commission_attribution.sql` dibuat
- [ ] Order lama (row existing) tidak error, kolom baru terisi default
- [ ] Insert order_items baru bisa menyertakan seller_id & commission_amount

---

### Phase 4 — Payout System
**Tujuan:** platform bisa mencatat pencairan dana ke seller secara batch.

```sql
CREATE TABLE public.seller_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending'::text,'processing'::text,'paid'::text,'failed'::text])),
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  paid_at timestamp with time zone,
  reference_no text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT seller_payouts_pkey PRIMARY KEY (id)
);

CREATE TABLE public.seller_payout_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payout_id uuid NOT NULL REFERENCES public.seller_payouts(id),
  order_item_id bigint NOT NULL REFERENCES public.order_items(id),
  CONSTRAINT seller_payout_items_pkey PRIMARY KEY (id)
);
```

RLS: seller hanya bisa `SELECT` payout miliknya sendiri (read-only, tidak
boleh insert/update — hanya admin/service role yang boleh menulis ke tabel ini).

**Acceptance criteria:**
- [ ] Migration file `0004_seller_payouts.sql` dibuat
- [ ] Seller A tidak bisa melihat payout milik seller B
- [ ] Seller tidak bisa insert/update row di `seller_payouts` sama sekali

---

### Phase 5 — RLS Review & Consolidation
**Tujuan:** review ulang semua policy dari Phase 1–4 dalam satu file
dokumentasi, pastikan tidak ada celah (misal buyer biasa bisa lihat data
sensitif seller lain).

Deliverable: bukan migration baru, tapi file `docs/rls-policy-overview.md`
berisi tabel: nama tabel → siapa boleh SELECT/INSERT/UPDATE/DELETE → alasan.

**Acceptance criteria:**
- [ ] Semua tabel baru (`sellers`, `seller_payouts`, `seller_payout_items`)
      dan kolom baru (`products.seller_id`, `order_items.seller_id`, dst)
      tercatat policy-nya
- [ ] Tidak ada tabel baru yang RLS-nya masih `disabled`

---

### Phase 6 — Application Layer (Onboarding Flow)
**Tujuan:** implementasi flow dari Section 3 di kode aplikasi (bukan lagi
skema database).

Scope:
- Halaman `/become-seller`: form `store_name`, generate `store_slug`,
  submit → insert ke `sellers` dengan `status = 'pending'`
- Guard/middleware: `/seller/*` hanya bisa diakses kalau
  `sellers.status = 'approved'` untuk `profile_id` yang login; kalau belum
  punya row sellers sama sekali → redirect ke `/become-seller`; kalau status
  `pending` → tampilkan halaman "menunggu approval"
- Halaman publik marketplace tetap dapat diakses tanpa perubahan apapun pada
  behavior lama
- Tidak mengubah flow login/signup Supabase Auth yang sudah ada

**Acceptance criteria:**
- [ ] User baru signup → default masuk sebagai buyer, tidak ada row sellers
- [ ] User klik "Daftar sebagai Seller" → wajib isi nama toko → row sellers
      dengan status pending terbuat
- [ ] Akses `/seller/*` sebelum status approved → diarahkan ke halaman
      status pending, bukan error/blank

---

## 5. Rollback Plan
- Setiap phase = migration file terpisah → rollback per phase dengan
  menuliskan migration `down` yang sesuai (drop tabel/kolom yang baru
  ditambahkan phase tsb saja), disiapkan sebagai file terpisah
  `NNNN_rollback.sql`, tidak otomatis dijalankan.
- Karena semua perubahan additive, rollback tidak akan pernah kehilangan data
  dari skema lama (Section 1) — hanya menghapus objek baru yang ditambahkan.

## 6. Definition of Done (Keseluruhan)
- [ ] Semua 4 migration file (Phase 1–4) ada di `supabase/migrations/`,
      terurut, masing-masing sudah direview manual
- [ ] `docs/rls-policy-overview.md` lengkap (Phase 5)
- [ ] Flow onboarding seller vs buyer berfungsi di aplikasi (Phase 6)
- [ ] Tidak ada satupun query/behavior lama yang berubah atau error
- [ ] Belum ada migration yang dijalankan ke project Supabase production