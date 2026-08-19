# Multi-Seller E-Commerce — Page & Flow Implementation Prompt

Dokumen ini melanjutkan `multi-seller-migration-plan.md` (skema database sudah
dianggap selesai/sesuai). Fokus dokumen ini: **halaman-halaman aplikasi dan
alur antar halaman** yang belum ada, supaya sesuai dengan fitur multi-seller.

Kerjakan **STEP 0 dulu, wajib, sebelum menyentuh kode apapun.**

---

## STEP 0 — Audit Struktur Project Saat Ini (WAJIB, jangan skip)

Sebelum membuat satu halaman pun, lakukan hal berikut dan laporkan hasilnya
ke saya dalam bentuk ringkasan (jangan langsung lanjut generate kode):

1. **Routing structure**: App Router atau Pages Router? List semua folder/
   file route yang sudah ada di `app/` atau `pages/` (termasuk nested routes,
   route groups, layout files).
2. **Auth implementation**: bagaimana sesi/login saat ini diimplementasi
   (Supabase Auth helper apa yang dipakai — `@supabase/ssr`, middleware,
   dsb)? Di mana redirect logic setelah login berada sekarang?
3. **Component/UI convention**: UI library apa yang dipakai (shadcn/ui,
   custom, Tailwind plain, dsb)? Di mana folder komponen shared berada?
4. **Data fetching pattern**: server component fetch langsung, atau lewat
   API routes/server actions? Ikuti pola yang SUDAH ADA, jangan perkenalkan
   pola baru tanpa alasan kuat.
5. **Halaman yang SUDAH ADA sekarang** — buat daftar lengkap (contoh:
   `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/orders`,
   `/profile`, dst — sesuaikan dengan yang benar-benar ada di repo, jangan
   asumsi dari dokumen ini).
6. **Naming & styling convention** yang dipakai di halaman existing (page
   title pattern, breadcrumb, loading state, empty state, dsb) — halaman
   baru harus konsisten dengan ini, bukan bikin gaya sendiri.

Setelah audit ini, buat **mapping**: dari daftar halaman baru di Section 2
di bawah, tandai mana yang:
- (a) benar-benar baru, belum ada sama sekali
- (b) sudah ada tapi perlu dimodifikasi (misal halaman produk perlu
  ditambah info "dijual oleh [toko]")
- (c) sudah ada dan tidak perlu diubah

Laporkan mapping ini dulu ke saya sebagai pesan terpisah. **Baru setelah
saya konfirmasi, lanjut ke implementasi per section di Step 1 dst.**

---

## Global Rules

1. Jangan mengubah/menghapus halaman existing yang **tidak** berhubungan
   dengan fitur multi-seller.
2. Halaman baru harus reuse komponen shared yang sudah ada (button, card,
   input, dsb) — jangan bikin komponen duplikat dengan nama berbeda.
3. Ikuti pola auth-guard yang sudah ada di project untuk melindungi
   halaman yang butuh login/role tertentu — jangan bikin sistem guard baru
   dari nol kalau sudah ada polanya.
4. Kerjakan **satu section (satu grup halaman) per giliran**, tampilkan hasil,
   tunggu saya bilang "lanjut" sebelum ke section berikutnya.
5. Setiap halaman baru: sebutkan juga apakah butuh loading state, empty
   state, dan error state — jangan hanya happy path.
6. Route/page yang butuh proteksi akses HARUS disebutkan eksplisit siapa
   yang boleh akses (public / logged-in user / seller approved / admin).
7. Jangan mengarang skema database baru di luar yang sudah didefinisikan di
   `multi-seller-migration-plan.md`. Kalau halaman butuh data yang belum
   ada kolomnya, tanyakan dulu, jangan langsung `ALTER TABLE` sendiri.

---

## Section 1 — Auth & Onboarding

| Halaman | Akses | Fungsi |
|---|---|---|
| `/login`, `/register` | Public | Sudah ada — pastikan tidak diubah, hanya cek redirect setelah login (lihat baris berikut) |
| `/onboarding` (halaman baru, muncul sekali setelah register pertama kali) | Logged-in, belum pernah pilih peran | Tanya: "Mau belanja atau buka toko?" Dua pilihan besar (card/button), bukan form kompleks |
| `/become-seller` | Logged-in, belum punya row `sellers` | Form: nama toko (wajib), deskripsi toko (opsional). Submit → insert `sellers` status `pending` → redirect ke halaman status pending |
| `/seller/pending` | Logged-in, punya row `sellers` status `pending` atau `rejected` | Halaman informatif: "Toko kamu sedang direview" / kalau rejected tampilkan alasan (jika ada) + tombol ajukan ulang |

Catatan alur: `/onboarding` cuma nongol sekali (first-time), setelahnya user
biasa (buyer) tidak pernah lihat pertanyaan ini lagi kecuali dia buka
`/become-seller` secara sadar dari menu profil/navbar.

---

## Section 2 — Public Marketplace (Buyer-facing)

| Halaman | Akses | Perubahan yang dibutuhkan |
|---|---|---|
| `/` (home) | Public | Kalau ada featured products, sertakan juga info singkat "dari X toko" (opsional, cek dulu apa sudah relevan) |
| `/products` (listing) | Public | Tambahkan filter/badge nama toko per produk (kalau `seller_id` tidak null) |
| `/products/[slug]` (detail produk) | Public | Tambahkan section "Dijual oleh [nama toko]" dengan link ke halaman toko, plus rating agregat toko (opsional) |
| `/stores/[slug]` (halaman baru — profil toko publik) | Public | Info toko (nama, deskripsi), list semua produk milik toko itu (query `products` where `seller_id` = toko & `status = 'published'`) |
| `/stores` (halaman baru — direktori semua toko, opsional) | Public | List semua seller dengan `status = 'approved'` |
| `/cart`, `/checkout` | Logged-in | Cek: kalau cart berisi produk dari beberapa seller berbeda, checkout tetap satu kali bayar (sesuai desain `order_items.seller_id` di migration plan) — tidak perlu split UI, cukup pastikan data attribution per seller kesimpan saat order dibuat |
| `/orders`, `/orders/[id]` | Logged-in | Tidak banyak berubah — pastikan tetap bisa lihat semua item meski dari seller berbeda dalam satu order |

---

## Section 3 — Seller Dashboard (baru semua)

Semua di bawah route group `/seller/*`, guard: hanya bisa diakses kalau
`sellers.status = 'approved'` untuk user yang login. Kalau belum approved,
redirect ke `/seller/pending`. Kalau belum punya row sellers sama sekali,
redirect ke `/become-seller`.

| Halaman | Fungsi |
|---|---|
| `/seller/dashboard` | Ringkasan: total penjualan, jumlah produk, pending payout, produk terlaris (angka sederhana dulu, chart opsional) |
| `/seller/products` | List produk milik seller ini saja (`WHERE seller_id = current seller`) |
| `/seller/products/new` | Form tambah produk baru — otomatis set `seller_id` = seller yang login, `status = 'pending_review'` (submit ke admin dulu, bukan langsung `published`) |
| `/seller/products/[id]/edit` | Edit produk milik sendiri saja — guard tambahan: tolak akses kalau `seller_id` produk itu bukan milik user yang login |
| `/seller/orders` | List `order_items` yang `seller_id`-nya = seller ini (bukan seluruh order, hanya item miliknya) |
| `/seller/payouts` | List riwayat `seller_payouts` miliknya, read-only |
| `/seller/settings` | Edit info toko: nama, deskripsi, rekening bank untuk payout |

---

## Section 4 — Admin Platform (baru sebagian)

Route group `/admin/*`, guard: hanya `profiles.role = 'admin'`.

| Halaman | Fungsi |
|---|---|
| `/admin/sellers` | List semua seller, filter by status. Tombol approve/reject untuk yang `pending` |
| `/admin/sellers/[id]` | Detail satu seller: info toko, daftar produknya, riwayat payout |
| `/admin/products/review` | List produk dengan `status = 'pending_review'`, tombol approve/reject |
| `/admin/payouts` | Buat batch payout baru (pilih periode, sistem hitung total per seller dari `order_items` yang `payout_status = 'held'` dan sudah lewat masa refund) |

Catatan: kalau project sudah punya halaman admin untuk hal lain (kelola
kategori, kupon, dsb — cek dari skema `categories`, `coupons`), ikuti pola
routing dan layout admin yang sudah ada, jangan bikin struktur admin baru
yang beda gaya.

---

## Section 5 — Navigasi & Komponen Bersama

- Navbar/header: tambahkan menu kondisional
  - User belum login → tombol login/register seperti biasa
  - User login, belum punya toko → item menu "Buka toko" mengarah ke `/become-seller`
  - User login, punya toko approved → item menu "Dashboard toko" mengarah ke `/seller/dashboard`
  - User admin → item menu "Admin" mengarah ke `/admin`
- Komponen baru yang kemungkinan dibutuhkan (cek dulu apa sudah ada yang
  mirip sebelum bikin baru): `StoreBadge` (nama toko kecil di card produk),
  `SellerStatusBanner` (banner status pending/rejected), `ApprovalActionButtons`
  (approve/reject dipakai di beberapa halaman admin)

---

## Urutan Pengerjaan yang Disarankan

1. STEP 0 (audit) — wajib duluan
2. Section 1 (auth/onboarding) — fondasi alur, semua section lain bergantung ini
3. Section 3 (seller dashboard) — seller perlu ini sebelum ada produk untuk ditampilkan di publik
4. Section 2 (public marketplace update) — setelah ada data seller & produk nyata untuk ditampilkan
5. Section 4 (admin) — bisa paralel dengan section 3, tapi disarankan terakhir supaya moderasi punya data nyata untuk ditest
6. Section 5 (navigasi) — terakhir, integrasi semua

Kerjakan berurutan sesuai nomor di atas, berhenti tiap section selesai,
tunggu saya review sebelum lanjut.