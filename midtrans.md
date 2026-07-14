# Integrasi Midtrans (Nuxt 3)

## Tujuan

Implementasikan integrasi pembayaran Midtrans Snap pada aplikasi Nuxt 3 dengan arsitektur yang aman, di mana seluruh komunikasi dengan Midtrans menggunakan **Server API** dan **Server Key tidak pernah dikirim ke client**.

---

# Requirement

- Nuxt 3
- Nitro Server API
- midtrans-client
- Environment Variable

Install dependency:

```bash
npm install midtrans-client
```

---

# Environment

Tambahkan environment berikut.

```env
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxx
MIDTRANS_IS_PRODUCTION=false
```

Expose hanya Client Key ke frontend.

```ts
runtimeConfig: {
  midtransServerKey: process.env.MIDTRANS_SERVER_KEY,
  midtransIsProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",

  public: {
    midtransClientKey: process.env.MIDTRANS_CLIENT_KEY
  }
}
```

---

# Struktur Folder

```
server/
 └── api/
      payment.post.ts
      midtrans/
          webhook.post.ts

pages/
    checkout.vue

plugins/
    midtrans.client.ts
```

---

# Langkah Implementasi

## 1. Buat API Create Transaction

Buat endpoint:

```
POST /api/payment
```

Tugas endpoint:

- membaca request dari frontend
- membuat instance Midtrans Snap
- memanggil `createTransaction()`
- mengembalikan:

```json
{
  "token": "...",
  "redirect_url": "..."
}
```

Jangan pernah expose Server Key.

---

## 2. Load Snap.js

Pada client, load:

Sandbox

```
https://app.sandbox.midtrans.com/snap/snap.js
```

Production

```
https://app.midtrans.com/snap/snap.js
```

Gunakan Client Key melalui atribut

```
data-client-key
```

Buat sebagai plugin Nuxt sehingga hanya dijalankan di client.

---

## 3. Checkout

Saat user klik tombol Bayar:

```
Frontend
    │
    ├── POST /api/payment
    │
    ├── menerima Snap Token
    │
    └── window.snap.pay(token)
```

Implementasikan callback berikut:

- onSuccess
- onPending
- onError
- onClose

Callback hanya untuk UI.

Status pembayaran tetap berasal dari webhook.

---

## 4. Webhook

Buat endpoint

```
POST /api/midtrans/webhook
```

Endpoint harus:

- menerima notification dari Midtrans
- memverifikasi signature
- memastikan notification valid
- update status order di database

Status yang harus didukung:

- pending
- settlement
- capture
- expire
- cancel
- deny
- refund
- partial_refund
- chargeback

Webhook merupakan source of truth.

---

# Database

Sebelum membuat transaksi Midtrans:

1. simpan order ke database
2. generate order_id
3. gunakan order_id tersebut pada Midtrans

Contoh field:

```
id
order_id
customer_name
customer_email
amount
status
snap_token
transaction_id
payment_type
created_at
updated_at
```

---

# Flow

```
User

    │
    ▼

Checkout Page

    │
    ▼

POST /api/payment

    │
    ▼

Nuxt Server

    │
    ▼

Midtrans createTransaction()

    │
    ▼

Snap Token

    │
    ▼

window.snap.pay()

    │
    ▼

User melakukan pembayaran

    │
    ▼

Midtrans

    │
    ├── Redirect User
    │
    └── Webhook

             │
             ▼

Update Database

             │
             ▼

Frontend membaca status terbaru
```

---

# Best Practice

- Server Key hanya berada di server.
- Client hanya mengetahui Snap Token.
- Jangan update status order dari callback frontend.
- Semua perubahan status berasal dari webhook.
- Gunakan order_id yang unik dari database.
- Simpan seluruh response Midtrans untuk kebutuhan audit.
- Selalu verifikasi signature webhook.
- Gunakan environment berbeda untuk Sandbox dan Production.

---

# Acceptance Criteria

Implementasi dianggap selesai apabila:

- [ ] Midtrans SDK berhasil terpasang.
- [ ] Environment tersimpan dengan benar.
- [ ] API `/api/payment` berhasil membuat Snap Token.
- [ ] Snap.js berhasil dimuat di client.
- [ ] User dapat membuka popup pembayaran.
- [ ] Webhook menerima notification Midtrans.
- [ ] Signature webhook diverifikasi.
- [ ] Status order di database berubah sesuai notification.
- [ ] Tidak ada Server Key yang dikirim ke frontend.
- [ ] Seluruh flow berjalan pada mode Sandbox.
