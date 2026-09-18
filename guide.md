Bisa. Ini saya buatkan **guide/prompt untuk AI agent** supaya dia tidak redesign total, tapi fokus merapikan posisi KPI card yang sudah ada.

````md
# TASK: Reorganize Admin Dashboard KPI Cards

Saya memiliki halaman **Admin Dashboard** untuk marketplace/e-commerce yang sudah berjalan dan sebagian besar section lain sudah selesai.

Fokus task ini HANYA pada bagian **8 KPI/statistic cards di bagian atas dashboard**.

Jangan redesign seluruh dashboard.
Jangan mengubah business logic, API, query, perhitungan data, atau source data.
Jangan menghapus KPI yang sudah ada.
Fokus pada:
- information hierarchy
- urutan card
- responsive layout
- spacing
- visual priority

---

## 1. CURRENT KPI CARDS

Saat ini terdapat 8 KPI:

1. Gross GMV
2. Completed Refunds
3. Net GMV
4. Net Platform Revenue
5. Successful Orders
6. Net Seller Earnings
7. Total Users
8. Active Sellers

Saat desktop, seluruh KPI ditampilkan dalam grid 4 kolom × 2 baris.

Pertahankan konsep grid tersebut.

---

# 2. NEW CARD ORDER

Susun ulang menjadi:

## ROW 1 — Primary Business KPIs

Urutan:

1. Gross GMV
2. Net GMV
3. Net Platform Revenue
4. Successful Orders

Visual:

[ Gross GMV ] [ Net GMV ] [ Platform Revenue ] [ Successful Orders ]

Tujuan:
Baris pertama harus langsung memberikan overview performa bisnis marketplace.

Alur informasinya:

Gross transaction value
→ value setelah refund
→ revenue platform
→ jumlah transaksi berhasil

---

## ROW 2 — Marketplace Supporting KPIs

Urutan:

1. Net Seller Earnings
2. Active Sellers
3. Total Users
4. Completed Refunds

Visual:

[ Seller Earnings ] [ Active Sellers ] [ Total Users ] [ Completed Refunds ]

Tujuan:
Baris kedua berisi marketplace health/supporting metrics.

Seller-related metrics ditempatkan berdekatan.

Completed Refunds ditempatkan paling akhir karena merupakan exception/negative metric dan bukan KPI utama yang harus dilihat pertama kali.

---

# 3. INFORMATION HIERARCHY

Walaupun semua card tetap memakai component yang sama, buat perbedaan visual kecil antara:

Primary KPI
vs
Secondary KPI

JANGAN membuat desainnya sangat berbeda.

Cukup lakukan subtle hierarchy.

Contoh:

Primary row:
- angka sedikit lebih prominent
- icon/background boleh sedikit lebih kuat
- tetap mengikuti existing design system

Secondary row:
- sedikit lebih compact/subtle
- tetap konsisten dengan primary cards

Jika hal tersebut membuat design inconsistency, prioritaskan konsistensi dan cukup ubah urutannya saja.

---

# 4. DO NOT CHANGE EXISTING DESIGN LANGUAGE

Pertahankan:

- dark theme
- existing border
- existing border radius
- existing icon style
- typography
- card background
- existing text colors
- existing hover states
- percentage indicator style

Jangan membuat desain baru yang berbeda dari dashboard sekarang.

Gunakan current component/style sebanyak mungkin.

---

# 5. CARD CONTENT

Struktur masing-masing card tetap:

Metric label

Main value

Supporting description

Growth/comparison indicator jika tersedia

Contoh:

Gross GMV

Rp 707.000

All successful sales before refunds

↑ +17.5% vs the previous 30 days

Jangan mengubah data atau perhitungannya.

---

# 6. GROWTH INDICATOR

Pastikan growth indicator tidak selalu dianggap positif hanya karena angkanya naik.

Untuk metric seperti:

- GMV
- Revenue
- Orders
- Users
- Sellers
- Seller Earnings

increase dapat dianggap positive.

Namun untuk:

Completed Refunds

kenaikan refund jangan otomatis menggunakan positive/green state.

Contoh:

Refund turun:
↓ -20%
→ positive

Refund naik:
↑ +20%
→ negative/warning

Gunakan existing color tokens dari project jika tersedia.

Jangan hardcode warna baru jika design system sudah memilikinya.

---

# 7. RESPONSIVE BEHAVIOR

Gunakan responsive grid.

Target:

Desktop besar:
4 columns

Tablet:
2 columns

Mobile:
1 column

Kurang lebih:

desktop:
grid-cols-4

tablet:
grid-cols-2

mobile:
grid-cols-1

Tetapi sesuaikan dengan Tailwind/breakpoint yang sudah digunakan project.

Jangan memaksakan class ini jika project sudah memiliki responsive convention sendiri.

---

# 8. CARD HEIGHT

Pastikan card dalam satu row memiliki tinggi yang konsisten.

Hindari kondisi seperti:

card A pendek
card B tinggi

karena description atau comparison text berbeda panjang.

Gunakan existing flex layout jika memungkinkan.

Contoh conceptual structure:

card
 ├── header
 │    ├── title
 │    └── icon
 │
 ├── value
 │
 ├── description
 │
 └── growth indicator

Growth indicator sebaiknya berada mendekati bagian bawah card secara konsisten.

Misalnya menggunakan:

display: flex
flex-direction: column

dan spacer/flex-grow pada description area.

---

# 9. SPACING

Pertahankan spacing dashboard sekarang.

Namun pastikan:

horizontal gap antar card konsisten

vertical gap antar row konsisten

card tidak terlalu tinggi hanya karena padding berlebihan.

Jika current cards terasa terlalu tinggi, boleh sedikit dikompakkan tetapi jangan sampai terlihat padat.

---

# 10. IMPORTANT: READ CURRENT IMPLEMENTATION FIRST

Sebelum melakukan perubahan:

1. Cari file/page Admin Dashboard.
2. Cari component KPI/stat card yang digunakan.
3. Cari data/config array yang menentukan urutan KPI.
4. Cari existing responsive grid.
5. Cari existing design tokens/components.

Jangan langsung membuat component baru.

Jika card sudah dibuat menggunakan array seperti:

```js
const stats = [...]
````

cukup reorganize urutan data jika memungkinkan.

Jika component sudah reusable:

PERTAHANKAN.

Hindari duplicate markup.

---

# 11. EXPECTED DESKTOP RESULT

Target visual:

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ ┌────────────────────┐
│ Gross GMV       │ │ Net GMV         │ │ Platform Revenue    │ │ Successful Orders  │
│ Rp xxx.xxx      │ │ Rp xxx.xxx      │ │ Rp xxx.xxx          │ │ xx                 │
│ ...             │ │ ...             │ │ ...                 │ │ ...                │
└─────────────────┘ └─────────────────┘ └─────────────────────┘ └────────────────────┘

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ ┌────────────────────┐
│ Seller Earnings │ │ Active Sellers  │ │ Total Users         │ │ Completed Refunds  │
│ Rp xxx.xxx      │ │ xx              │ │ xx                  │ │ Rp xxx.xxx         │
│ ...             │ │ ...             │ │ ...                 │ │ ...                │
└─────────────────┘ └─────────────────┘ └─────────────────────┘ └────────────────────┘

---

# 12. DO NOT

Do NOT:

* redesign the whole dashboard
* move existing charts/sections unnecessarily
* change database queries
* change API endpoints
* change financial calculation logic
* rename database fields
* remove KPI cards
* introduce a new UI library
* create unnecessary duplicated components
* modify unrelated files
* replace the existing design system

---

# 13. AFTER IMPLEMENTATION

After implementing:

1. Verify all 8 KPI cards still display correct values.
2. Verify comparison percentage still works.
3. Verify responsive layout.
4. Verify cards have consistent heights.
5. Verify no existing dashboard sections break.
6. Verify no unnecessary duplicate code was introduced.

Then provide me with:

* files changed
* short explanation of each change
* why the new ordering improves information hierarchy
* whether any existing code was refactored

```

Kalau AI agent kamu punya akses penuh ke project, bagian **“READ CURRENT IMPLEMENTATION FIRST”** itu penting. Jadi dia tidak asal bikin ulang component padahal kemungkinan besar kamu tinggal mengubah urutan array/config KPI yang sudah ada. 
```
