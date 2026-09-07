# Rencana My Purchases dan batas download

Tanggal inspeksi: 7 September 2026. Status: diimplementasikan secara lokal; migration remote belum di-push. Lihat `docs/my-purchases-rollout.md` untuk hasil verifikasi dan langkah aktivasi.

Dokumen ini berdasarkan kode dan migration lokal sampai `0040`. Database Supabase produksi belum diperiksa atau diubah. `current-sb-schema.sql` belum memuat sejumlah perubahan migration terbaru, termasuk histori download `0039`, sehingga bukan satu-satunya acuan.

## 1. Perilaku yang dituju

- Setelah pembayaran diverifikasi server, produk langsung muncul di **Dashboard → My Purchases** (`/purchases`), tanpa menunggu download pertama.
- Selama kepemilikan aktif, pembeli tidak bisa membeli produk yang sama lagi, termasuk melalui lisensi berbeda, tab lain, cart lama, atau request API langsung.
- Produk dikeluarkan dari cart. Record produk, order, pembayaran, dan lisensi tetap tersimpan; My Purchases adalah tampilan koleksi kepemilikan, bukan pemindahan atau penghapusan record transaksi.
- Setiap kepemilikan aktif memiliki kuota **3 download**, digunakan bersama oleh semua perangkat dan semua halaman. Kuota bukan per perangkat, per hari, per file versi, atau per tombol.
- Produk tetap ada di My Purchases setelah kuota habis. Pembeli dapat melihat lisensi, detail order, dan menghubungi seller, tetapi tombol download berubah menjadi `Download limit reached`.
- Keputusan pengguna: **pembelian ulang diperbolehkan setelah refund berhasil**. Request refund yang pending, gagal, atau memerlukan tindakan manual belum membuka pembelian ulang.
- Usulan untuk pembelian ulang setelah refund: pembayaran baru memberi kepemilikan baru dengan 3 download baru. Order yang direfund tetap tidak dapat dipakai mendownload; histori dan penghitung order lama tidak direset.
- Catalog tetap menampilkan produk dengan status `Purchased` dan tombol `View in My Purchases` untuk pemiliknya. Belum ada kebutuhan menyembunyikannya dari hasil katalog publik.
- Bahasa UI tetap Inggris, mengikuti tema brand, pola dashboard, dan layout mobile proyek.

## 2. Temuan inspeksi

| Area | Implementasi sekarang | Dampak terhadap rencana |
| --- | --- | --- |
| Kepemilikan | `user_products` sudah ada; migration `0016` membuat unique index `(profile_id, product_id)` | Gunakan tabel ini sebagai sumber kepemilikan aktif; tidak perlu tabel kepemilikan kedua |
| Payment fulfillment | `server/utils/order-delivery.ts` memanggil `finalize_paid_order`; implementasi terbaru ada di `0038` | Pakai alur webhook/reconciliation yang sama agar kepemilikan terbit hanya setelah payment terverifikasi |
| Duplikasi pembayaran | Fulfillment memakai `ON CONFLICT DO NOTHING` untuk ownership, tetapi tetap menandai order lain sebagai paid | Unique ownership belum mencegah pembeli membayar dua kali |
| Cart | `server/api/cart/items.post.ts` memvalidasi self-purchase seller dan lisensi | Belum menolak produk yang telah dimiliki buyer |
| Checkout | RPC terbaru di `0029` mengunci dan mencari pending order berdasarkan buyer + product + license | Lisensi berbeda bisa membuat dua invoice untuk produk yang sama |
| Histori download | `0039` sudah menambah `is_downloaded`, `downloaded_at`, `download_count` pada `order_items` | Tidak perlu menambah ulang flag download; perlu aturan kuota |
| Kuota | `record_order_item_download` mengunci order item lalu menaikkan counter tanpa batas | Wajib tambah pemeriksaan kuota atomik di database |
| Pengiriman file | `server/api/orders/[id]/download.get.ts` mengembalikan signed URL selama 300 detik | Pembatasan jumlah link tidak sama dengan membatasi pengunduhan melalui link tersebut |
| Ownership download | Endpoint memeriksa buyer + product, belum mencocokkan `ownership.order_id` dengan order yang diminta | Order paid duplikat dapat memakai penghitung terpisah |
| UI download | `pages/orders/index.vue` dan `pages/orders/[id].vue` menggandakan handler dan fallback `download_count + 1` | Gunakan handler dan state server yang sama di semua entry point |
| Dashboard | Sudah ada My orders, Messages, My refunds | Tambahkan My Purchases dalam kelompok aktivitas yang sama |
| Buy now | Detail produk tetap mengarah ke cart setelah `addToCart()` yang menangkap error tanpa melemparnya kembali | Perbaiki propagasi kegagalan agar penolakan ownership tidak diikuti navigasi sukses |
| Refund | `apply_order_refund` di `0016` menandai refunded dan menghapus ownership berdasarkan `order_id` | Cocok untuk keputusan pengguna; akses order lama harus tetap tertutup sesudah pembelian ulang |

Catatan: istilah `isOwnProduct` yang ada berarti produk milik seller sendiri. Status produk yang dibeli buyer harus memakai nama berbeda, misalnya `isPurchased`.

## 3. Tahap 1 — Audit data dan migration additive

Saat implementasi dimulai, periksa terlebih dahulu data dan izin dengan query read-only:

1. Cocokkan migration remote dengan lokal, khususnya `0039` dan `0040`.
2. Inventarisasi RLS/grant aktual untuk `orders`, `order_items`, `user_products`, `download_logs`, `product_files`, dan bucket ZIP `products`. Migration awal tidak memuat seluruh policy bawaan.
3. Cari paid order tanpa ownership, ownership yang mengarah ke refunded/non-paid order, beberapa paid order untuk buyer + product yang sama, serta beberapa invoice pending lintas lisensi.
4. Inventarisasi `download_count > 3` dan log lama tanpa identitas order. Jangan mengasumsikan semua penghitung awal nol.

Siapkan migration baru, sementara bernama `0041_purchase_access_and_download_limits.sql` jika nomor masih tersedia saat implementasi. Jangan mengedit ulang migration yang sudah applied.

Isi migration yang direncanakan:

- Pertahankan unique index ownership dan kolom histori `0039`.
- Tambah `order_items.download_limit` dengan default 3, ditulis server, untuk menyimpan batas pada pembelian terkait.
- Tambah tabel kecil `purchase_download_sessions` untuk tiket unduh sekali pakai: order item, buyer, hash token, request/idempotency key, status, waktu kedaluwarsa, waktu mulai, dan kegagalan sebelum streaming. Hanya trusted server yang dapat mengubahnya.
- Kaitkan event download baru dengan order item/session secara eksplisit; field tambahan pada `download_logs` dibuat nullable agar log lama tetap valid. Hindari foreign key yang membuat penghapusan ownership saat refund gagal.
- Ubah RPC checkout, fulfillment, refund, dan konsumsi download agar menggunakan aturan ownership serta urutan lock yang konsisten.
- Pastikan buyer tidak dapat menaikkan batas, menurunkan counter, membuat ownership, atau menandai order paid melalui Supabase langsung. Endpoint tetap memverifikasi session sebelum memakai service role.

Migrasi data lama harus mempertahankan counter dan histori. Nilai di atas 3 tidak diturunkan: sisa kuota menjadi 0. Jangan menambah constraint `download_count <= 3` yang akan merusak data historis. Rekonsiliasi paid order duplikat dan log yang ambigu dilakukan sebelum aktivasi batas, tanpa menghapus transaksi atau memberikan kuota baru untuk setiap duplicate order.

Jika ownership utama telah direfund tetapi masih ada duplicate order berstatus paid, fallback eligibility masih harus menganggap pembayaran itu belum selesai ditangani. Selesaikan rekonsiliasi duplikasi tersebut sebelum membuka pembelian ulang; jangan menyembunyikan pembayaran yang belum dikembalikan.

## 4. Tahap 2 — Pencegahan pembelian ulang

Gunakan satu aturan eligibility berdasarkan **buyer + product**, terlepas dari lisensi:

1. API cart menolak produk yang sudah dimiliki dengan `409 product_already_purchased` dan referensi pembeliannya. Tambahkan guard database untuk insert/update cart langsung.
2. RPC checkout memeriksa ownership aktif dan paid order yang belum direfund sebagai fallback untuk data lama yang ownership-nya belum lengkap. Pemeriksaan berada dalam transaksi, sebelum invoice baru diterbitkan.
3. Lock checkout diubah dari buyer + product + license menjadi buyer + product. Jalur kompatibilitas RPC dua argumen harus tetap masuk ke validasi yang sama.
4. Maksimum satu proses checkout aktif per buyer + product: pending order untuk lisensi yang sama dapat dilanjutkan; pemilihan lisensi lain ditolak selama invoice lama belum terkonfirmasi tidak dapat dibayar. API mengembalikan `409 product_payment_pending` dan link order existing.
5. Bila pembuatan invoice timeout, status hasil provider dianggap belum diketahui. Rekonsiliasi dulu sebelum membuka invoice pengganti, agar respons provider yang terlambat tidak menyebabkan double payment.
6. Setelah paid terverifikasi, fulfillment tetap atomik: grant ownership sekali, hapus seluruh varian lisensi produk itu dari cart, dan tandai order paid. Webhook ulang untuk order yang sama tidak mengubah kuota.
7. Pembayaran ganda dari invoice lama tetap dicatat sebagai uang yang benar-benar diterima dan ditandai untuk rekonsiliasi/refund melalui alur admin existing. Jangan diam-diam mengabaikan pembayaran atau menerbitkan ownership/kuota kedua. Item konflik ditahan dari payout otomatis sampai diselesaikan.

Menghapus/mengubah status order lokal tidak otomatis menonaktifkan invoice provider. Penutupan invoice lama merupakan langkah rollout yang ditinjau berdasarkan inventarisasi data, bukan operasi massal dalam migration SQL.

## 5. Tahap 3 — Download maksimal tiga kali

Definisi operasional yang diusulkan: **tiga sesi download yang diotorisasi dan mulai dikirim server**. Browser tidak memberi bukti tepercaya bahwa pengguna telah menyimpan ZIP sampai selesai. Karena itu kuota tidak bergantung pada callback sukses dari frontend.

Signed URL Supabase adalah akses berbatas waktu dan bisa dipakai ulang selama valid; mengurangi masa berlakunya tidak menjadikannya tiket sekali pakai. Karena pengguna meminta batas download, pengiriman perlu dikontrol server. Lihat [dokumentasi Supabase](https://supabase.com/docs/guides/storage/serving/downloads).

Alur yang direncanakan:

1. Klik Download mengirim POST terautentikasi untuk meminta tiket singkat. GET halaman, prefetch, dan membuka My Purchases tidak menghabiskan kuota.
2. Tiket menyimpan buyer dan pembelian di server; token acak disimpan dalam bentuk hash, sekali pakai, berumur pendek, dan tidak memuat JWT/service key. Retry permintaan tiket memakai idempotency key.
3. Browser membuka endpoint penukaran tiket untuk download native. Endpoint mengecek kepemilikan aktif kembali, paid order, kesesuaian `ownership.order_id`, file ZIP, status tiket, serta sisa kuota. Auth proyek saat ini menggunakan Bearer header, yang tidak otomatis ikut dalam navigasi link: tambahkan binding cookie HttpOnly, Secure, SameSite dengan umur/path terbatas yang diterbitkan POST setelah verifikasi session, lalu validasi binding/session ketika tiket ditukar. Tiket tidak cukup hanya menyimpan buyer ID; binding harus dibatalkan pada logout/account switch melalui server.
4. RPC mengunci ownership/order item yang menjadi sumber akses, mengklaim tiket, dan mengambil satu kuota secara atomik. Request bersamaan tidak bisa membuat counter melewati batas. Semua akses lewat order lama harus mengarah ke kuota yang sama atau ditolak jika bukan order sumber kepemilikan aktif.
5. Server membaca ZIP private lalu meneruskan stream, tanpa memberikan signed URL storage kepada browser atau meredirect ke URL itu. Hindari buffering seluruh ZIP ke memori.
6. File tidak ditemukan, auth gagal, tiket belum dikonsumsi, atau kegagalan yang terkonfirmasi sebelum streaming tidak menghabiskan kuota. Reservasi memiliki lease/kedaluwarsa dan recovery idempotent untuk worker yang mati sebelum beralih ke status started. Transisi ke started wajib mengecek lease masih aktif; worker yang terlambat tidak boleh mengirim file setelah reservasinya dibatalkan. Sesudah started, putus koneksi tidak mengembalikan kuota. Jika proses mati pada batas antara penandaan started dan pengiriman byte, perlakukan sebagai sesi terpakai/ambigu untuk audit, bukan mengembalikan kuota tanpa bukti.
7. Response dan endpoint tiket memakai `private, no-store`; token tidak ditulis ke log aplikasi. Versi awal tidak menyediakan reusable Range/resume tanpa kontrol sesi. Request ulang atau tiket terpakai tidak boleh menjadi transfer tambahan gratis.
8. Endpoint GET download lama harus ditutup atau diarahkan ke mekanisme terkendali yang sama. Tidak boleh ada jalur signed URL lama yang masih melewati batas.

API metadata mengembalikan `download_count`, `download_limit`, `downloads_remaining`, dan `can_download`. Frontend selalu memakai nilai server, termasuk saat menerima `403 download_limit_reached`.

ZIP proyek dibatasi sampai 200 MB. Vercel menyarankan streaming untuk response yang melebihi batas body biasa; karena deployment saat ini Vercel, pengiriman stream harus dibuktikan bekerja pada adapter Nuxt/Nitro yang dipakai, termasuk timeout dan koneksi Android lambat. Lihat [panduan resmi Vercel](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions). Ini menjadi pemeriksaan integrasi sebelum rollout, bukan asumsi bahwa seluruh file dapat dimuat sebagai Blob.

## 6. Tahap 4 — API, state, dan My Purchases

File baru yang diusulkan mengikuti pola repository → service → Pinia → page/composable:

- `server/api/purchases/index.get.ts`: koleksi milik session aktif, pagination server, pencarian, tanggal pembayaran, metadata produk/toko yang aman, snapshot lisensi, referensi order, dan sisa kuota. Tidak mengirim URL ZIP maupun payload payment provider.
- `server/api/purchases/ownership.get.ts`: lookup ownership ringan secara batch untuk ID produk yang sedang tampil. Beri batas jumlah ID, jangan membuat satu request untuk setiap card atau memuat seluruh order pembeli untuk setiap halaman.
- Endpoint POST tiket dan endpoint streaming satu kali sebagaimana tahap 3.
- `repositories/purchasesRepository.js`, `services/purchasesService.js`, `stores/purchasesStore.js`.
- `composables/usePurchaseDownload.js`: aksi bersama untuk My Purchases dan shortcut di order detail.
- `pages/purchases/index.vue`: library responsif dengan loading skeleton, empty/error state, pagination, dan status akses yang jelas.

Daftar My Purchases dibaca dari ownership aktif. Produk yang tidak lagi published tetap dapat dikenali lewat endpoint pembelian privat yang memvalidasi ownership, bukan mengandalkan query katalog publik. File yang hilang ditampilkan sebagai unavailable tanpa menghilangkan bukti pembelian atau menghabiskan kuota.

Tambahkan kartu `My Purchases` beserta jumlah kepemilikan pada `pages/dashboard.vue`. Item menampilkan gambar, nama, tanggal beli, lisensi yang dibeli, `3 downloads remaining`, tombol Download, View order, dan akses pesan seller bila tersedia. Riwayat refund tetap di My orders/My refunds. Review tetap di order detail sesuai pola saat ini.

`purchasesStore` harus terikat pada profile ID, menggabungkan request identik yang sedang berjalan, membuang respons akun lama setelah account switch, serta direset pada logout seperti cart/wishlist di `app.vue`. Tambahkan `/purchases` pada auth middleware. Halaman privat tetap noindex dan tidak masuk cache publik/SSR lintas user.

## 7. Tahap 5 — Sambungkan semua titik masuk

| File/area | Perubahan yang direncanakan |
| --- | --- |
| `pages/products/index.vue`, `composables/useCatalogUI.js` | Purchased badge dan CTA ke My Purchases; cek ownership dari batch state |
| `pages/products/[slug].vue`, `composables/useProductDetailUI.js` | Tutup pembelian ulang semua lisensi; propagasikan kegagalan add-to-cart dengan benar |
| `pages/wishlist.vue` | Produk terbeli mengarah ke pembelian, bukan menambah cart |
| `pages/cart.vue`, cart service/repository/store | Produk yang sudah terbeli tidak dapat dipilih/checkout; tampilkan alasan ownership yang berbeda dari seller self-purchase |
| `pages/orders/index.vue` | Jadikan View purchase sebagai akses utama produk paid; pertahankan invoice dan riwayat order |
| `pages/orders/[id].vue` | Link My Purchases dan shortcut download yang memakai kuota sama; review tetap di sini |
| `pages/dashboard.vue` | Kartu My Purchases, konsisten desktop/mobile |
| `app.vue`, `middleware/auth.global.js` | Reset state akun dan proteksi route privat |
| API buyer orders + tampilan admin/seller orders | Tampilkan counter/batas server yang konsisten untuk bantuan pengguna |

Setelah kembali dari Xendit, halaman order harus menunggu status paid yang dikonfirmasi server lalu me-refresh purchases/cart. Detail order saat ini hanya fetch sekali ketika mount, jadi tambahkan refresh/poll terbatas selama pending dengan cleanup saat unmount. Redirect sukses dari browser saja tidak pernah memberi ownership.

Setelah refund sukses, refresh kepemilikan dan eligibility. Usulan kuota baru hanya diberikan ketika pembelian ulang benar-benar paid; webhook duplikat, membuka halaman, update ZIP, atau memilih lisensi lain tidak me-reset kuota.

## 8. Tahap 6 — Skenario penerimaan dan rollout

| Skenario | Hasil yang wajib |
| --- | --- |
| Buyer pertama kali membayar produk | Ownership sekali; cart bersih; My Purchases tampil sebelum download pertama |
| Membeli lagi lewat catalog, detail, wishlist, cart lama, atau API | Ditolak sebagai already purchased, termasuk lisensi berbeda |
| Dua tab checkout beda lisensi untuk produk sama | Hanya satu proses/invoice aktif |
| Invoice provider timeout/hasil tidak diketahui | Rekonsiliasi; tidak langsung membuat invoice pengganti |
| Webhook paid diterima berulang | Tidak ada ownership, pembayaran, atau kuota tambahan |
| Download 1, 2, 3 lalu 4 | Tiga sesi diizinkan; keempat ditolak di server |
| Sisa 1, ada beberapa request serentak | Tepat satu berhasil mengambil kuota |
| My Purchases dan order detail dipakai bergantian | Menghabiskan kuota yang sama |
| Replay tiket/link lama atau order paid duplikat | Tidak memperoleh transfer/kuota tambahan |
| Buyer lain/guest memakai ID pembelian | Data privat dan download ditolak |
| POST retry dengan idempotency key sama | Tidak membuat konsumsi tambahan |
| Worker mati saat reservasi dan kemudian retry | Reservasi belum started dipulihkan secara idempotent; worker lama tidak bisa mengirim setelah lease batal |
| File tidak ada atau kegagalan sebelum stream | Kuota tidak hilang; error terlihat |
| Refund pending/failed/manual action | Pembelian ulang masih ditolak |
| Refund sukses | Akses lama dicabut; membeli ulang diperbolehkan |
| Refund sukses lalu pembelian ulang paid | Kepemilikan baru, usulan 3 kuota baru; order refunded tetap tidak bisa download |
| Data historis sudah didownload lebih dari 3 kali | Counter asli dipertahankan; remaining 0 |
| Logout lalu login akun lain | Ownership/counter akun lama tidak muncul |
| Produk unpublished, versi ZIP berubah, atau file unavailable | Bukti pembelian tetap terlihat; perubahan file tidak mereset kuota |
| Android 320–430 px dan desktop | Card, tombol, pagination, dan download native dapat digunakan |
| ZIP besar pada deployment Vercel | Stream bekerja tanpa buffering seluruh file dan tanpa membocorkan storage URL |

Verifikasi implementasi nantinya memakai unit/integration test terarah untuk aturan purchase, RPC concurrency/izin, refund lifecycle, dan replay download, ditambah pemeriksaan UI/browser. Tidak menjalankan build otomatis setelah setiap perubahan. Uji alur provider memakai test mode ketika masuk tahap implementasi, bukan saat perencanaan ini.

Urutan rollout: inventarisasi remote/data → migration additive dan perbaikan data yang jelas → backend guard/download → UI → pengujian integrasi → aktivasi. Penanganan transaksi lama yang ambigu dilaporkan untuk ditinjau, bukan diubah massal. Bila runtime ternyata memerlukan perubahan hosting/config untuk streaming, sampaikan kebutuhan spesifik setelah pengujian.

Cutover download harus menghentikan penerbitan signed URL lama dan memperhitungkan link yang sudah terbit: TTL saat ini 300 detik. Periksa juga cache policy storage/CDN sebelum menyatakan seluruh akses tunduk pada batas baru, sebab expiry token dan umur cache adalah pengaturan terpisah menurut [dokumentasi Smart CDN Supabase](https://supabase.com/docs/guides/storage/cdn/smart-cdn). Selama masa transisi, link lama tidak bisa dianggap otomatis tercabut hanya karena kode endpoint sudah diganti.

## 9. Pembaruan implementasi

Pengguna menyetujui implementasi setelah memilih bahwa pembelian ulang diperbolehkan sesudah refund sukses. Migration `0041_purchase_eligibility.sql` dan `0042_purchase_download_sessions.sql` serta API, state, halaman My Purchases, dan integrasi UI telah dibuat. Tidak ada build, push database, atau transaksi Xendit yang dijalankan.

Penyederhanaan teknis terhadap rancangan awal: tiket ditebus melalui native form POST dalam iframe same-origin (bukan GET dengan token di URL). File private dibuka dan chunk pertama diperiksa sebelum transaksi atomik menandai tiket `started` dan menambah counter. Tidak ada kuota yang direservasi saat menunggu storage, sehingga lease/decrement/recovery reservasi tidak diperlukan. Kegagalan sebelum transaksi tidak mengurangi kuota; sesudah transaksi commit, transfer yang terputus/ambigu tetap dihitung. Kuota baru tiga kali diberikan pada order baru yang paid setelah refund sukses; order lama tetap tidak memiliki akses.

Audit read-only remote cocok sampai migration `0040`. Tidak ditemukan duplicate paid/pending, ownership invalid, paid tanpa ownership, atau invoice pending tanpa receipt. Satu item historis memiliki count di atas tiga; count tersebut dipertahankan. Pengujian PostgreSQL lokal, streaming H3 lokal, unit test, dan parsing source dijelaskan di dokumen rollout; uji Vercel/Android nyata masih perlu dilakukan setelah migration/deploy.
