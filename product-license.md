# Panduan untuk AI Agent: Implementasi Sistem Lisensi Produk & Chat Pembeli-Seller

## Konteks Project
Ini adalah marketplace digital asset berbasis Supabase (Postgres). Skema yang sudah ada memakai konvensi:
- Primary key `uuid` dengan `gen_random_uuid()`, kecuali entity lama yang pakai `bigint identity` (mis. `products`, `order_items`)
- Semua tabel domain-sensitif punya `created_at timestamptz DEFAULT now()`
- Constraint `CHECK` untuk enum-like text field (bukan native `ENUM`), gaya: `status = ANY (ARRAY['a','b'])`
- FK selalu dinamai `<table>_<column>_fkey`
- RLS (Row Level Security) aktif di semua tabel — setiap tabel baru WAJIB punya policy RLS, jangan biarkan default (yang berarti tertutup total tanpa service role)
- Sudah ada sistem chat AI support (`conversations`, `messages`, `escalations`) — **jangan reuse tabel ini untuk chat pembeli-seller**, karena modelnya berbeda (AI-driven vs peer-to-peer, tanpa `role`/`sender_type` AI, tanpa token tracking)

Tugas kamu ada 2 bagian independen. Kerjakan sebagai migration terpisah.

---

## BAGIAN 1: Sistem Lisensi Produk

### Tujuan
Setiap produk digital bisa punya 1+ tier lisensi (Personal, Commercial, Extended) dengan harga dan batasan penggunaan berbeda. Pembelian harus mengunci (snapshot) lisensi yang dibeli — jangan hanya referensi FK ke tabel master, karena kalau seller ubah syarat lisensi nanti, riwayat pembelian lama tidak boleh berubah.

### Tabel yang perlu dibuat

**1. `license_types`** (master/reference, opsional tapi disarankan untuk konsistensi lintas produk)
- `id uuid pk`
- `name text NOT NULL` — mis. "Personal Use", "Commercial Use", "Extended License"
- `slug text UNIQUE NOT NULL`
- `description text`
- `created_at timestamptz`

**2. `product_licenses`** (tier lisensi per produk — ini yang tampil di halaman produk untuk dipilih pembeli)
- `id uuid pk`
- `product_id bigint NOT NULL FK -> products(id)`
- `license_type_id uuid FK -> license_types(id)` (nullable kalau seller mau bikin custom tanpa master type)
- `name text NOT NULL` (override display name kalau perlu)
- `price integer NOT NULL DEFAULT 0 CHECK (price >= 0)`
- `usage_terms text NOT NULL` — deskripsi batasan penggunaan dalam bahasa manusia
- `max_end_products integer` — nullable, misal "boleh dipakai di maks 1 proyek klien"
- `allow_resale boolean NOT NULL DEFAULT false`
- `allow_commercial_use boolean NOT NULL DEFAULT false`
- `is_active boolean NOT NULL DEFAULT true`
- `sort_order integer NOT NULL DEFAULT 0`
- `created_at timestamptz`, `updated_at timestamptz`
- Constraint: minimal 1 `product_licenses` aktif per produk yang `status = 'published'` — ini **tidak bisa** jadi CHECK constraint SQL biasa (butuh cross-row validation), jadi buat sebagai trigger atau validasi di application layer. Jelaskan ini di komentar migration, jangan skip diam-diam.

**3. `order_item_licenses`** (snapshot lisensi yang dibeli — kaitkan ke `order_items`, BUKAN ke `product_licenses` secara langsung untuk data yang tidak boleh berubah)
- `id uuid pk`
- `order_item_id bigint NOT NULL UNIQUE FK -> order_items(id)`
- `product_license_id uuid FK -> product_licenses(id)` — boleh nullable kalau lisensi aslinya nanti dihapus, referensi historis tetap ada di kolom snapshot
- `license_name_snapshot text NOT NULL`
- `usage_terms_snapshot text NOT NULL`
- `allow_commercial_use_snapshot boolean NOT NULL`
- `allow_resale_snapshot boolean NOT NULL`
- `price_snapshot integer NOT NULL`
- `created_at timestamptz`

### Perubahan ke tabel existing
- `cart_items` dan `order_items` saat ini hanya refer ke `product_id`, belum menangkap **lisensi mana** yang dipilih. Tambahkan:
  - `cart_items.product_license_id uuid FK -> product_licenses(id)` (nullable dulu untuk backward compat, lalu enforce NOT NULL setelah migrasi data)
  - `order_items` tidak perlu kolom baru kalau pakai tabel `order_item_licenses` di atas — tapi pastikan proses checkout membaca `product_license_id` dari cart dan menulis snapshot ke `order_item_licenses` saat order dibuat, bukan saat dibayar (harga sudah dikunci dari cart).

### RLS yang perlu dibuat
- `product_licenses`: SELECT publik untuk baris `is_active = true` pada produk berstatus `published`; INSERT/UPDATE/DELETE hanya oleh `seller_id` pemilik produk (join ke `products.seller_id -> sellers.profile_id`) atau admin.
- `order_item_licenses`: SELECT hanya oleh pembeli terkait (`order_items -> orders.profile_id = auth.uid()`) dan seller terkait, serta admin. Tidak ada INSERT/UPDATE langsung dari client — hanya lewat service role saat proses checkout.

### Validasi yang wajib ditegakkan di application layer (bukan hanya DB)
- Total `commission_amount` dan `seller_earning` di `order_items` harus dihitung dari `price_snapshot` lisensi yang dipilih, bukan `products.price` — karena harga bisa beda per tier lisensi.
- Jangan izinkan checkout kalau `product_license_id` yang dipilih sudah `is_active = false` (lisensi ditarik seller setelah user add-to-cart tapi sebelum checkout).

---

## BAGIAN 2: Chat Pembeli–Seller

### Tujuan
Fitur pesan langsung antara pembeli dan seller (pre-sale question atau after-sale support), terpisah dari sistem AI chat support yang sudah ada.

### Tabel yang perlu dibuat

**1. `buyer_seller_threads`**
- `id uuid pk`
- `buyer_id uuid NOT NULL FK -> profiles(id)`
- `seller_id uuid NOT NULL FK -> sellers(id)`
- `product_id bigint FK -> products(id)` — nullable (bisa chat umum ke toko tanpa konteks produk spesifik), tapi isi kalau chat dimulai dari halaman produk
- `order_id uuid FK -> orders(id)` — nullable, isi kalau chat terkait order tertentu (mis. komplain file rusak)
- `status text NOT NULL DEFAULT 'open' CHECK (status = ANY (ARRAY['open','closed','archived']))`
- `last_message_at timestamptz`
- `buyer_unread_count integer NOT NULL DEFAULT 0 CHECK (buyer_unread_count >= 0)`
- `seller_unread_count integer NOT NULL DEFAULT 0 CHECK (seller_unread_count >= 0)`
- `created_at timestamptz`, `updated_at timestamptz`
- Constraint UNIQUE opsional: `(buyer_id, seller_id, product_id)` kalau mau 1 thread per kombinasi produk (hindari thread duplikat berulang untuk produk yang sama) — diskusikan dengan saya dulu sebelum diterapkan karena ini keputusan produk, bukan cuma teknis.

**2. `buyer_seller_messages`**
- `id uuid pk`
- `thread_id uuid NOT NULL FK -> buyer_seller_threads(id)`
- `sender_profile_id uuid NOT NULL FK -> profiles(id)`
- `content text NOT NULL CHECK (char_length(btrim(content)) >= 1 AND char_length(btrim(content)) <= 5000)`
- `attachment_url text` — nullable, untuk lampiran screenshot bukti masalah (bukan file produk asli — jangan izinkan seller kirim file produk lewat sini, itu jalur `product_files`/`download_logs`)
- `is_read boolean NOT NULL DEFAULT false`
- `read_at timestamptz`
- `created_at timestamptz`

**3. `buyer_seller_reports`** (opsional tapi disarankan sejak awal — moderasi)
- `id uuid pk`
- `thread_id uuid NOT NULL FK -> buyer_seller_threads(id)`
- `reported_by uuid NOT NULL FK -> profiles(id)`
- `reason text NOT NULL`
- `status text NOT NULL DEFAULT 'open' CHECK (status = ANY (ARRAY['open','reviewed','dismissed']))`
- `reviewed_by uuid FK -> profiles(id)`
- `created_at timestamptz`

### Trigger/fungsi yang perlu dibuat
- Trigger `AFTER INSERT` di `buyer_seller_messages`: update `buyer_seller_threads.last_message_at`, dan increment `seller_unread_count` atau `buyer_unread_count` tergantung siapa `sender_profile_id` (bandingkan ke `buyer_id`/`seller_id` di thread).
- Fungsi/endpoint `mark_thread_read(thread_id, profile_id)`: set `is_read = true` untuk pesan yang belum dibaca, reset counter unread pihak terkait ke 0.

### RLS yang perlu dibuat
- `buyer_seller_threads`: SELECT/UPDATE hanya oleh `buyer_id = auth.uid()` ATAU seller yang `sellers.profile_id = auth.uid()`. INSERT hanya kalau `auth.uid() = buyer_id` (buyer yang memulai chat) — atau izinkan seller juga memulai kalau ada use case reply proaktif, sesuaikan kebijakan produk kamu.
- `buyer_seller_messages`: SELECT/INSERT hanya oleh partisipan thread (cek lewat join ke `buyer_seller_threads`). Larang UPDATE `content` setelah terkirim (no edit) — kalau butuh edit, tambahkan `edited_at` bukan mutasi diam-diam.
- `buyer_seller_reports`: INSERT oleh partisipan thread; SELECT/UPDATE hanya admin.

### Hal yang harus diperhatikan agent saat implementasi
1. **Jangan gabungkan dengan sistem AI chat yang sudah ada.** `conversations`/`messages` punya kolom AI-specific (`model`, `finish_reason`, `estimated_cost_microusd`, dll) yang tidak relevan di sini — bikin skema jadi kotor kalau dipaksakan reuse.
2. **Rate limit pengiriman pesan** di application layer (bisa manfaatkan pola `api_rate_limits` yang sudah ada) untuk cegah spam antar buyer-seller.
3. **Notifikasi**: karena belum ada tabel `notifications` di skema ini, agent perlu tanya dulu apakah notifikasi email/push sudah ditangani di layer lain sebelum asumsi perlu bikin tabel baru.
4. Realtime: kalau pakai Supabase Realtime untuk chat, pastikan RLS di atas benar-benar diuji — kebocoran chat antar user yang tidak terkait adalah risiko privasi serius.

---

## Urutan Kerja yang Disarankan untuk Agent
1. Buat migration Bagian 1 (lisensi) dulu — ini mengubah alur checkout, jadi butuh testing lebih dalam sebelum lanjut.
2. Update logic checkout/cart untuk menangani `product_license_id`.
3. Baru kerjakan Bagian 2 (chat) — independen, risikonya lebih rendah terhadap alur transaksi inti.
4. Tulis test untuk RLS di kedua bagian sebelum deploy — RLS yang salah tidak akan error saat development tapi jadi celah keamanan di production.