### File: `seo.md`

```markdown
# 🚀 Nuxt 3 AI Agent Integration & Google SEO Setup Guide

Dokumen ini berisi panduan untuk **AI Agent** guna melakukan pengintegrasian otomatis pada proyek Nuxt 3 agar siap di-deploy ke Vercel dan terindeks dengan cepat oleh Google Search Console.

---

## 📋 Tugas untuk AI Agent (Task List)

Silakan eksekusi langkah-langkah teknis berikut pada struktur basis kode (*codebase*) Nuxt 3:

### 1. Konfigurasi SEO Dashboard & Meta Tag (`nuxt.config.ts`)
Tambahkan metadata global dan pastikan SSR aktif agar konten dapat di-crawl oleh Googlebot.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Pastikan SSR diaktifkan (default: true)
  ssr: true,

  app: {
    head: {
      title: 'Nama Website Utama',
      titleTemplate: '%s - Slogan Website',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Deskripsi singkat website untuk hasil pencarian Google.' },
        { name: 'robots', content: 'index, follow' }
      ],
      link: [
        { rel: 'canonical', href: '[https://domainkamu.com](https://domainkamu.com)' }
      ]
    }
  },

  // Mengizinkan variabel lingkungan publik
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || '[https://domainkamu.com](https://domainkamu.com)'
    }
  }
})

```

---

### 2. Pembuatan File `sitemap.xml`

Buat Server Route di file `server/routes/sitemap.xml.ts` untuk memproduksi daftar URL secara dinamis:

```typescript
// server/routes/sitemap.xml.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const baseUrl = config.public.siteUrl

  // Tambahkan daftar rute statis/dinamis kamu di sini
  const routes = [
    '',
    '/about',
    '/contact',
  ]

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="[http://www.sitemaps.org/schemas/sitemap/0.9](http://www.sitemaps.org/schemas/sitemap/0.9)">
  ${routes
    .map(
      (route) => `
    <url>
      <loc>${baseUrl}${route}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>daily</changefreq>
      <priority>${route === '' ? '1.0' : '0.8'}</priority>
    </url>`
    )
    .join('')}
</urlset>`

  event.node.res.setHeader('Content-Type', 'text/xml')
  return sitemapXml
})

```

---

### 3. Pembuatan File `robots.txt`

Buat Server Route di file `server/routes/robots.txt.ts` untuk memberi tahu bot mana yang boleh di-crawl:

```typescript
// server/routes/robots.txt.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const baseUrl = config.public.siteUrl

  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`

  event.node.res.setHeader('Content-Type', 'text/plain')
  return robotsTxt
})

```

---

### 4. Menambahkan File Lingkungan (`.env`)

Pastikan file `.env` memiliki variabel `NUXT_PUBLIC_SITE_URL`:

```env
NUXT_PUBLIC_SITE_URL=[https://domainkamu.com](https://domainkamu.com)

```

---

## 🛠️ Langkah Manual (Dikerjakan Oleh Pemilik Proyek)

Setelah AI Agent menyelesaikan tugas pengkodean di atas dan kamu berhasil melakukan deployment ke Vercel:

### 1. Set Environment Variable di Vercel

1. Masuk ke **Vercel Dashboard** > Pilih Proyek.
2. Buka **Settings** > **Environment Variables**.
3. Tambahkan:
* **Key:** `NUXT_PUBLIC_SITE_URL`
* **Value:** `https://domainkamu.com` (atau domain bawaan Vercel `.vercel.app`).



### 2. Verifikasi Domain di Google Search Console (GSC)

1. Buka [Google Search Console](https://search.google.com/search-console).
2. Tambahkan Properti Baru (Pilih opsi **Domain** atau **URL prefix**).
3. Salin kode **TXT Record** verifikasi dari Google.
4. Di Vercel Dashboard, buka **Settings** > **Domains** > Tambahkan **DNS TXT Record**:
* **Type:** `TXT`
* **Name:** `@`
* **Value:** *(Tempel kode dari GSC)*


5. Kembali ke GSC dan klik **Verify**.

### 3. Kirimkan Sitemap

1. Pada menu navigasi kiri di Google Search Console, buka **Sitemaps**.
2. Masukkan URL sitemap kamu: `sitemap.xml`.
3. Klik **Submit**.
4. Gunakan fitur **URL Inspection** untuk memasukkan URL utama kamu dan klik **Request Indexing** untuk mempercepat pemrosesan Google.

```

```