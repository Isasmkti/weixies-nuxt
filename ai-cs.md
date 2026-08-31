# Requirement & Roadmap: AI Agent Customer Service (Gemini + Supabase)

## 1. Latar Belakang
Platform e-commerce ini membutuhkan AI Chat Customer Service berbasis Gemini API untuk:
- Menjawab pertanyaan produk, kebijakan, dan FAQ secara otomatis
- Membantu user cek status pesanan, stok, dan detail transaksi secara real-time
- Mengurangi beban tim CS manusia untuk pertanyaan repetitif
- Meningkatkan response time dan pengalaman belanja pelanggan

## 2. Tujuan (Objectives)
1. AI agent mampu menjawab pertanyaan umum (FAQ, kebijakan, cara pakai produk) dengan akurat berbasis knowledge base.
2. AI agent mampu mengakses data dinamis (order, stok, harga) melalui function calling, bukan data statis yang mudah usang.
3. Percakapan tersimpan dan dapat direview/dianalisis untuk peningkatan kualitas.
4. Ada mekanisme eskalasi ke CS manusia saat AI tidak mampu menjawab atau user meminta.
5. Sistem aman (RLS, rate limiting, validasi input) dan scalable untuk volume chat tinggi.

## 3. Functional Requirements

### 3.1 Chat Interface
- Widget chat di web/app (guest & logged-in user)
- Riwayat percakapan tersimpan per user/sesi
- Typing indicator, quick reply/suggested questions
- Tombol "Hubungi CS Manusia" untuk eskalasi manual

### 3.2 Kemampuan AI Agent
- Menjawab FAQ & kebijakan toko (retur, garansi, pengiriman) via RAG
- Menjawab pertanyaan produk (spesifikasi, ketersediaan, rekomendasi) via RAG + function calling
- Cek status pesanan by order ID / user login via function calling
- Cek stok & harga real-time via function calling
- Deteksi intent eskalasi (komplain berat, permintaan refund kompleks) → handover ke agent manusia

### 3.3 Admin/Backoffice
- Dashboard untuk melihat log percakapan
- Edit/update knowledge base (FAQ, kebijakan) tanpa perlu deploy ulang
- Melihat metrik: jumlah chat, resolution rate, rata-rata rating, topik populer
- Kelola eskalasi yang masuk ke tim CS manusia

### 3.4 Non-Functional Requirements
- **Latency**: respons AI < 3 detik untuk kasus umum
- **Keamanan**: RLS Supabase aktif di semua tabel chat & user data; API key Gemini disimpan server-side saja
- **Skalabilitas**: desain tabel & query siap untuk ribuan percakapan/hari
- **Observability**: logging error, token usage, dan biaya API per hari
- **Fallback**: jika Gemini API down/error, tampilkan pesan fallback dan opsi kontak CS manual

## 4. Arsitektur Singkat
```
User → Chat Widget → Backend API (Edge Function / Server)
                         ├─ Ambil histori & konteks dari Supabase
                         ├─ RAG: cari embedding relevan (pgvector) dari kb_articles/product_embeddings
                         ├─ Kirim ke Gemini API (dengan tools/function declarations)
                         ├─ Gemini panggil function (get_order_status, search_product, dst) bila perlu
                         └─ Simpan respons ke Supabase → tampilkan ke user
```

## 5. Skema Data (Ringkas)
| Tabel | Fungsi |
|---|---|
| `conversations` | Sesi chat per user/guest |
| `messages` | Riwayat pesan (role: user/assistant/system) |
| `kb_articles` | Knowledge base FAQ/kebijakan + embedding vector |
| `product_embeddings` | Embedding deskripsi produk untuk semantic search |
| `chat_feedback` | Rating/feedback user atas jawaban AI |
| `escalations` | Log kasus yang dieskalasi ke CS manusia |
| `products`, `orders`, `customers` (existing) | Diakses via function calling, tidak diduplikasi |

## 6. Fase Pengembangan (Phases)

### Phase 1 — Foundation & Data Layer
- Setup project Supabase: enable extension `pgvector`
- Buat tabel `conversations`, `messages`, `kb_articles`, `chat_feedback`, `escalations`
- Setup RLS policy dasar (user hanya bisa akses percakapan miliknya)
- Setup koneksi & environment variable Gemini API key (server-side)

**Output**: skema database siap, koneksi API tervalidasi dengan test call sederhana.

### Phase 2 — Core Chat Engine (MVP)
- Buat endpoint/Edge Function untuk terima pesan user, kirim ke Gemini, simpan respons
- Implementasi chat widget dasar di frontend (kirim/terima pesan, tampilkan histori)
- AI hanya menjawab dari system prompt umum (belum ada RAG/function calling)

**Output**: chat AI dasar sudah bisa dipakai end-to-end (tanpa data dinamis).

### Phase 3 — Knowledge Base & RAG
- Migrasi/isi `kb_articles` dan `product_embeddings` (generate embedding dari deskripsi produk & FAQ)
- Implementasi semantic search (cosine similarity via pgvector) sebelum request ke Gemini
- Sisipkan hasil retrieval sebagai konteks ke prompt Gemini
- Admin UI sederhana untuk tambah/edit knowledge base

**Output**: AI bisa jawab pertanyaan produk & kebijakan secara akurat berbasis data toko sendiri.

### Phase 4 — Function Calling untuk Data Dinamis
- Definisikan Gemini function declarations: `get_order_status`, `check_stock`, `get_product_detail`, dll
- Implementasi handler function calling di backend, query langsung ke tabel `orders`/`products`
- Validasi keamanan: user hanya bisa akses order miliknya sendiri (cek auth/session)

**Output**: AI bisa jawab "pesanan saya sampai mana?" atau "stok ukuran M masih ada?" secara real-time.

### Phase 5 — Eskalasi, Rating & Admin Dashboard
- Deteksi intent eskalasi (keyword/kompleksitas) → buat entri di `escalations`, notifikasi ke tim CS
- Tambah fitur rating/feedback pasca-chat (`chat_feedback`)
- Dashboard admin: log chat, metrik dasar (volume, resolution rate, topik populer)

**Output**: alur handover ke CS manusia berjalan, tim punya visibilitas kualitas AI agent.

### Phase 6 — Hardening, Testing & Launch
- Rate limiting per user/IP untuk cegah abuse & kontrol biaya API
- Testing: unit test function calling, uji skenario percakapan edge case
- Load testing untuk estimasi biaya & performa di volume tinggi
- Monitoring: log error, token usage, biaya harian
- Soft launch (limited user) → evaluasi → full rollout

**Output**: sistem siap produksi, termonitor, dan terkontrol biayanya.

## 7. Metrik Keberhasilan
- Resolution rate AI (tanpa eskalasi) ≥ 70%
- Rata-rata rating kepuasan ≥ 4/5
- Response time rata-rata < 3 detik
- Penurunan volume tiket CS manual untuk pertanyaan repetitif

## 8. Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Biaya API membengkak | Rate limiting, caching jawaban FAQ umum, monitoring token usage |
| Jawaban AI tidak akurat/halusinasi | RAG ketat pada knowledge base terverifikasi, function calling untuk data faktual |
| Data sensitif user bocor | RLS ketat, function calling divalidasi dengan auth/session user |
| Downtime Gemini API | Fallback message + graceful degradation ke form kontak CS |