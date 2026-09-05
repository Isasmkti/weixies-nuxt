Saya memiliki project e-commerce yang sudah berjalan dan memiliki alur login, autentikasi, fetch data, serta beberapa section halaman.

Masalah utama saat ini:

Setelah user berhasil login dan diarahkan ke halaman utama/dashboard, konten tidak muncul secara bersamaan. Beberapa bagian halaman muncul satu per satu setelah request masing-masing selesai, sehingga UI terasa seperti "nyicil render", kurang stabil, dan kurang profesional.

Tugas kamu adalah memperbaiki masalah tersebut, tetapi JANGAN langsung melakukan perubahan besar atau membuat arsitektur baru dari asumsi.

## 1. Audit project saat ini terlebih dahulu

Baca dan pahami struktur project yang sudah ada.

Cari dan pelajari bagian yang berkaitan dengan:

* proses login
* authentication/session
* middleware auth jika ada
* redirect setelah login
* Pinia/store/state management
* composables
* plugin Supabase jika ada
* `useFetch`
* `useAsyncData`
* `$fetch`
* `onMounted`
* API/server endpoint
* layout
* halaman yang dibuka setelah login
* komponen homepage/dashboard
* navbar/header
* profile
* cart
* wishlist jika ada
* product
* category
* recommended/suggested product
* loading state
* skeleton
* penggunaan `v-if`
* penggunaan client-only fetch
* SSR/CSR behavior

Jangan berasumsi nama file tertentu ada.

Temukan implementasi aktual dari project ini.

## 2. Telusuri penyebab render satu-per-satu

Identifikasi kenapa setelah login konten muncul bertahap.

Periksa apakah terdapat pola seperti:

```ts
await fetchA()
await fetchB()
await fetchC()
```

yang seharusnya bisa berjalan secara paralel.

Periksa juga apakah masing-masing child component melakukan fetch sendiri seperti:

```text
Home
├── ProductSection → fetch products
├── CategorySection → fetch categories
├── RecommendationSection → fetch recommendations
├── Cart → fetch cart
└── Profile → fetch profile
```

Jika iya, analisis apakah pola tersebut memang cocok untuk project saat ini atau justru menyebabkan waterfall request dan layout muncul satu per satu.

Periksa juga kemungkinan:

* session Supabase belum siap saat redirect
* auth state baru terinisialisasi setelah halaman terbuka
* store diinisialisasi berkali-kali
* fetch yang saling menunggu tanpa perlu
* duplicate API request
* request berjalan serial
* `onMounted()` menyebabkan data baru mulai dimuat setelah client mount
* `v-if` menyebabkan layout bergeser saat data masuk
* navbar/cart/profile menunggu request berbeda
* halaman kehilangan SSR karena logic tertentu
* hydration/loading state tidak konsisten
* komponen child terlalu banyak memegang lifecycle fetch sendiri

## 3. Jangan langsung menggabungkan semua request

Jangan menggunakan satu endpoint besar hanya supaya semua data selesai bersamaan tanpa mempertimbangkan arsitektur project.

Pisahkan terlebih dahulu data menjadi kategori yang sesuai.

Contoh konsep:

### Global state

Data yang memang digunakan lintas halaman, seperti:

```text
auth/session
user/profile
cart
wishlist
```

bisa dipertimbangkan tetap berada di store/composable global.

### Page-specific data

Data seperti:

```text
products
categories
recommendations
banner
featured products
```

boleh dikelola oleh page atau composable yang sesuai.

Tetapi keputusan akhirnya HARUS berdasarkan struktur project saya saat ini.

Jangan memaksakan pola ini jika project mempunyai desain yang lebih sesuai.

## 4. Optimalkan fetch independen

Jika terdapat beberapa request yang tidak saling bergantung, jalankan secara paralel.

Contoh prinsip:

```ts
const [
  products,
  categories,
  recommendations
] = await Promise.all([
  fetchProducts(),
  fetchCategories(),
  fetchRecommendations()
])
```

Tetapi jangan asal mengganti semua request menjadi `Promise.all`.

Jika request B membutuhkan hasil A, tetap pertahankan dependency yang benar.

## 5. Perbaiki UX loading

Target akhirnya bukan sekadar membuat request cepat.

Saya ingin transisi setelah login menjadi stabil seperti:

```text
Login berhasil
↓
Redirect
↓
Layout halaman langsung stabil
↓
Skeleton/loading state tampil
↓
Request berjalan paralel jika memungkinkan
↓
Data selesai
↓
Konten menggantikan skeleton tanpa layout jumping berlebihan
```

Hindari kondisi seperti:

```text
halaman kosong
↓
navbar muncul
↓
profile muncul
↓
product muncul
↓
category muncul
↓
recommendation muncul
```

Gunakan skeleton/loading state yang mengikuti desain UI project saat ini.

Jangan mengubah visual design secara drastis.

## 6. Periksa proses login

Audit proses login yang ada.

Pastikan redirect tidak dilakukan dalam kondisi auth/session yang belum benar-benar siap.

Jika menggunakan Supabase, periksa flow aktual seperti:

```ts
supabase.auth.signInWithPassword(...)
```

lalu bagaimana session disimpan, dideteksi, dan digunakan setelah `navigateTo`.

Jangan membuat login flow baru jika implementasi sekarang sebenarnya sudah benar.

Hanya ubah bagian yang memang menyebabkan race condition, double fetch, atau state belum siap.

## 7. Pertahankan behavior yang sudah bekerja

Jangan merusak:

* login
* logout
* register
* RLS Supabase
* cart
* checkout
* payment
* middleware
* API contract
* TypeScript type
* existing composables
* state yang sudah bekerja
* SEO/SSR behavior
* responsive UI

Hindari refactor besar yang tidak diperlukan.

Prioritaskan perubahan minimum dengan dampak maksimum.

## 8. Cari duplicate fetch

Periksa apakah data yang sama diambil berkali-kali.

Contoh:

```text
Navbar → fetch profile
Home → fetch profile
CartButton → fetch profile
UserMenu → fetch profile
```

Jika data yang sama sudah tersedia di store atau composable global, gunakan sumber state yang sama daripada meminta API berulang kali.

Lakukan hal serupa untuk cart dan data global lainnya.

## 9. Perhatikan Nuxt lifecycle

Jika project ini menggunakan Nuxt, gunakan pendekatan yang paling sesuai dengan Nuxt yang sudah dipakai project.

Evaluasi apakah data sebaiknya memakai:

* `useAsyncData`
* `useFetch`
* `$fetch`
* Pinia action
* composable
* server-side data fetching

Jangan otomatis memindahkan semuanya ke `onMounted`.

Sebaliknya, jika terdapat data penting yang sekarang hanya dimuat melalui:

```ts
onMounted(async () => {
  ...
})
```

analisis apakah itu penyebab halaman kosong sebelum hydration dan apakah sebaiknya dipindahkan ke mekanisme Nuxt yang lebih tepat.

## 10. Berikan analisis sebelum mengubah kode

Sebelum melakukan perubahan, tuliskan ringkasan:

```text
Current flow:
Login
→ ...
→ ...
→ Home

Masalah ditemukan:
1. ...
2. ...
3. ...

Waterfall:
request A
→ request B
→ request C

Request yang sebenarnya bisa paralel:
- ...
- ...

Data global:
- ...

Data page-specific:
- ...
```

Setelah itu baru implementasikan perbaikannya.

## 11. Implementasi secara bertahap

Kerjakan dalam urutan:

### Phase 1 — Audit

Pahami project dan identifikasi bottleneck.

### Phase 2 — Auth flow

Pastikan session/state login stabil sebelum halaman bergantung padanya.

### Phase 3 — Data fetching

Hilangkan waterfall yang tidak diperlukan dan jalankan request independen secara paralel.

### Phase 4 — State management

Hilangkan duplicate fetch dan gunakan store/composable yang sudah tersedia dengan benar.

### Phase 5 — Loading UX

Buat skeleton/loading state yang stabil.

### Phase 6 — Cleanup

Hapus logic loading/fetch lama yang sudah tidak diperlukan tanpa merusak behavior lain.

## 12. Setelah implementasi

Berikan laporan perubahan dengan format:

```text
FILES ANALYZED
- ...

ROOT CAUSE
- ...

FILES CHANGED
- ...

BEFORE
- ...

AFTER
- ...

PARALLELIZED REQUESTS
- ...

DUPLICATE REQUESTS REMOVED
- ...

AUTH FLOW CHANGES
- ...

LOADING UX CHANGES
- ...

POTENTIAL RISKS
- ...

MANUAL TEST CHECKLIST
- ...
```

## Target akhir

Saya ingin homepage/dashboard setelah login terasa seperti aplikasi modern:

```text
Auth ready
        ↓
Page initialized
        ↓
┌────────────────────────────┐
│ Requests berjalan paralel  │
├────────┬────────┬───────────┤
│Product │Category│Recommend. │
└────────┴────────┴───────────┘
        ↓
State selesai
        ↓
Konten tampil secara stabil
```

Prioritas utama:

1. pahami project existing terlebih dahulu
2. cari root cause sebenarnya
3. jangan membuat asumsi struktur project
4. jangan overengineering
5. hindari breaking changes
6. optimalkan waterfall request
7. hilangkan duplicate fetch
8. pertahankan SSR/Nuxt behavior jika relevan
9. buat loading UX stabil
10. sesuaikan seluruh solusi dengan kondisi project saya saat ini
