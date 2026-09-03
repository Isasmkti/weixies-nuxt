# Panduan Styling — Weixies Dashboard

Referensi untuk AI agent saat membangun/mengubah UI. Arah visual: **Google/Material-inspired** — bersih, rounded secara selektif (bukan semua elemen dibulatkan sama rata), shadow tipis sebagai penanda elevasi (bukan dekorasi), dan hierarki yang jelas lewat ukuran & bobot, bukan warna gradient.

Prinsip inti: **radius dan shadow membawa informasi.** Semakin besar/penting sebuah elemen kontainer, semakin besar radiusnya. Elemen kecil/dense (input, chip, baris tabel) pakai radius kecil atau tidak sama sekali. Jangan pernah pakai satu nilai radius untuk semua elemen — itu yang bikin desain terasa generik.

---

## 1. Skala Radius (bertingkat, bukan seragam)

Definisikan sebagai token, jangan hardcode angka di banyak tempat.

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--radius-none` | 0px | Divider, table row, elemen di dalam list yang rapat |
| `--radius-xs` | 4px | Chip kecil, badge status, checkbox |
| `--radius-sm` | 8px | Input field, button sekunder, tag |
| `--radius-md` | 12px | Button utama, card kecil (list item, notifikasi) |
| `--radius-lg` | 16px | Card konten (produk, panel form) |
| `--radius-xl` | 24px | Container besar/hero banner, modal |
| `--radius-full` | 999px | Avatar, pill toggle (Light/Dark/System), FAB |

Aturan pakai:
- **Card banner besar** (seperti "Your shop is ready to grow") → `--radius-xl`
- **Card form** (Edit Profile, System Preferences) → `--radius-lg`
- **Input & tombol di dalamnya** → `--radius-sm` (button utama boleh `--radius-md`)
- **Toggle pill** (Light/Dark/System) → `--radius-full`, ini salah satu tempat yang memang pas untuk full-round ala Google
- **Avatar/profile photo** → `--radius-full` untuk foto profil kecil di sidebar, tapi `--radius-lg` untuk preview foto besar (kotak, bukan lingkaran) di form edit
- **Sidebar item aktif** (highlight menu) → `--radius-md`, bukan full pill

Jangan: nge-set satu `border-radius` global lewat `* { border-radius: 16px }` atau semacamnya. Radius harus jadi keputusan per-komponen.

---

## 2. Elevasi & Shadow

Google-style pakai shadow sangat tipis, berlapis, untuk menunjukkan "seberapa tinggi" elemen itu — bukan shadow gelap dekoratif.

```css
--elevation-0: none; /* elemen menyatu dengan background, mis. table row */
--elevation-1: 0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08);
--elevation-2: 0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
--elevation-3: 0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06);
```

- Card statis (form, panel info) → `--elevation-1`
- Card yang bisa di-hover/interaktif (item produk, item cart) → `--elevation-1` default, naik ke `--elevation-2` saat hover
- Modal/dropdown/popover → `--elevation-3`
- Sidebar & top bar → `--elevation-0` atau border tipis (`1px solid`) saja, bukan shadow — karena mereka bagian dari "lantai" aplikasi, bukan objek yang mengambang

Jangan pakai shadow berwarna (mis. `box-shadow: 0 4px 12px rgba(99,102,241,0.4)` warna ungu) — itu ciri khas "AI generated card kit". Shadow harus netral abu-abu gelap transparan.

---

## 3. Warna

Karena arah "seperti Google", basisnya: **latar netral terang, satu warna aksen yang jelas, warna semantik untuk status.** Bukan gradient sebagai warna utama.

| Token | Contoh Hex | Peran |
|---|---|---|
| `--surface` | `#FFFFFF` | Background card |
| `--surface-alt` | `#F8F9FA` | Background halaman/sidebar |
| `--border` | `#E3E5E8` | Border tipis antar elemen |
| `--text-primary` | `#1F2124` | Judul, teks utama |
| `--text-secondary` | `#5F6368` | Deskripsi, label |
| `--accent` | *(pilih 1 warna brand kamu — bukan ungu default)* | Tombol utama, link, state aktif |
| `--accent-hover` | *(accent, sedikit lebih gelap ~10%)* | Hover state |
| `--success` | `#1E8E3E` | Status berhasil/paid |
| `--warning` | `#F9AB00` | Status pending |
| `--danger` | `#D93025` | Status gagal/error |

Catatan: **jangan pakai gradient sebagai fill tombol atau banner.** Kalau butuh warna aksen di banner besar, pakai flat color solid dengan kontras teks yang cukup, atau outline/border berwarna dengan background netral — bukan gradient dua warna.

Pilih 1 warna `--accent` yang benar-benar merepresentasikan brand Weixies (bukan indigo/ungu default AI). Kalau belum ada brand color, saran: pilih dari family warna yang jarang dipakai template AI — hijau teal, biru laut yang lebih tua/muted, atau oranye burnt — lalu pertahankan konsisten di seluruh produk.

---

## 4. Tipografi

- Font: **Google Sans / Product Sans** kalau available secara lisensi, atau alternatif serupa seperti **Inter** / **Manrope** / **Plus Jakarta Sans** — sans-serif dengan karakter geometris-humanis, bukan default sistem generik (Arial/Helvetica polos).
- Jangan pakai ALL CAPS untuk label field (FULL NAME → ganti "Full name", sentence case).
- Jangan bold semua judul section sama beratnya — beri hierarki:

| Level | Ukuran | Weight | Contoh |
|---|---|---|---|
| Display | 28–32px | 600 | Judul halaman ("Your shop is ready to grow") |
| Heading | 20–22px | 600 | Judul card ("Edit Profile") |
| Body | 14–15px | 400 | Deskripsi, paragraf |
| Label | 12–13px | 500 | Label input, caption — sentence case, bukan caps |

---

## 5. Komponen Spesifik dari Screenshot Kamu

**Banner hero ("Your shop is ready to grow")**
- Ganti gradient ungu → flat `--accent` atau `--surface-alt` dengan aksen border/ilustrasi kecil di sisi kanan (bukan tombol gradient)
- Radius `--radius-xl`, shadow `--elevation-1`

**Card "Edit Profile" & "System Preferences"**
- Radius `--radius-lg`, shadow `--elevation-1`, border `1px solid var(--border)` tipis (Google sering pakai border tipis + shadow minimal, bukan shadow tebal tanpa border)
- Hapus box info dengan emoji ✨ — ganti jadi teks kecil biasa di bawah field, atau icon outline info kalau perlu penekanan

**Toggle Light/Dark/System**
- Ini elemen yang cocok tetap full-rounded (`--radius-full`) — segmented control ala Google Settings, pertahankan gaya ini, tapi pastikan hanya background dari opsi terpilih yang solid, sisanya transparan (bukan semua opsi punya background)

**Sidebar**
- Item menu aktif: background `--surface-alt` atau `--accent` dengan opacity rendah, radius `--radius-md`, bukan pill full-round
- Hilangkan shadow di sidebar, cukup border kanan tipis untuk pisahkan dari konten

**Floating "AI Support" bubble**
- Ganti dari bubble bulat generik → pill dengan icon + label teks ("AI Support"), radius `--radius-full` boleh dipertahankan di sini karena FAB memang salah satu tempat yang tepat untuk full-round, tapi styling fill-nya pakai `--accent` solid, bukan gradient, dan shadow `--elevation-2`

---

## 6. Checklist Sebelum Selesai

- [ ] Tidak ada satu pun `border-radius` yang sama persis dipakai di >3 komponen berbeda tanpa alasan (kecuali memang by design, seperti radius input dan button sekunder yang sengaja disamakan)
- [ ] Tidak ada gradient dipakai sebagai fill utama tombol/card/banner
- [ ] Tidak ada shadow berwarna
- [ ] Semua label pakai sentence case, bukan ALL CAPS
- [ ] Tidak ada emoji dekoratif di UI produksi (icon outline oke, emoji tidak)
- [ ] Warna aksen konsisten satu across seluruh dashboard (bukan ungu di satu tempat, biru di tempat lain)