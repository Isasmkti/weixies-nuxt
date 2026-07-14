# Feature: Integrasi Midtrans + Supabase (Digital Product)

## Tujuan

Menambahkan sistem pembayaran menggunakan Midtrans Snap pada aplikasi Nuxt 3 dengan backend Supabase.

Produk yang dijual adalah **digital product** berupa file ZIP yang disimpan di **Supabase Storage**.

User hanya dapat mengunduh file setelah pembayaran berhasil (`settlement` / `capture`).

---

# Tech Stack

- Nuxt 3
- Nitro Server API
- Supabase
- Supabase Storage
- Midtrans Snap
- midtrans-client

---

# Arsitektur

```
Client (Nuxt)

        │

        ▼

Nuxt Server API
(create payment)

        │

        ▼

Midtrans Snap

        │

        ▼

Webhook

        │

        ▼

Supabase Database

        │

        ▼

Download File ZIP
```

---

# Database

## products

Produk digital.

```sql
id uuid
name
slug
price
storage_path
cover_image
description
is_active
created_at
```

Contoh

```
storage_path

products/template-admin.zip
```

File fisik berada di Supabase Storage.

---

## orders

```sql
id uuid

order_number

product_id

user_id

amount

status

midtrans_transaction_id

payment_type

snap_token

snap_redirect_url

created_at

updated_at
```

Status:

```
pending

paid

expired

cancelled

failed

refunded
```

---

## downloads

(Optional)

Digunakan untuk audit download.

```sql
id

order_id

user_id

downloaded_at

ip_address
```

---

# Storage

Buat bucket

```
products
```

Isi bucket

```
template-admin.zip

landing-page.zip

ebook.zip
```

Jangan expose bucket sebagai Public apabila ingin membatasi akses download.

Gunakan Signed URL.

---

# Flow Pembelian

```
User

↓

Pilih Product

↓

Checkout

↓

POST /api/payment

↓

Nuxt Server

↓

Insert Order (pending)

↓

Create Midtrans Transaction

↓

Update snap_token

↓

Return Snap Token

↓

Frontend

↓

window.snap.pay()

↓

User Bayar

↓

Midtrans

↓

Webhook

↓

Update Order

↓

status = paid

↓

User dapat Download
```

---

# Langkah Implementasi

## Step 1

Saat user klik beli:

Frontend mengirim

```
product_id
```

ke

```
POST /api/payment
```

---

## Step 2

Server mengambil data product dari Supabase.

```
SELECT *

FROM products

WHERE id = ?
```

Gunakan harga dari database, **jangan percaya harga dari frontend**.

---

## Step 3

Insert order.

```
status

pending
```

Generate

```
order_number
```

Misal

```
ORD-20260702-00001
```

atau

gunakan UUID.

---

## Step 4

Buat transaksi Midtrans.

```
transaction_details

order_id = order_number

gross_amount = product.price
```

---

## Step 5

Update order.

Simpan

```
snap_token

redirect_url
```

---

## Step 6

Return

```
snap_token
```

ke frontend.

---

## Step 7

Frontend

```
window.snap.pay(token)
```

---

# Webhook

Endpoint

```
POST /api/midtrans/webhook
```

Harus:

- verifikasi signature
- cek transaction status
- update order

Contoh mapping

```
pending

↓

status = pending

------------------

settlement

↓

status = paid

------------------

capture

↓

status = paid

------------------

expire

↓

status = expired

------------------

cancel

↓

status = cancelled

------------------

deny

↓

status = failed

------------------

refund

↓

status = refunded
```

Webhook adalah source of truth.

Jangan update status berdasarkan callback frontend.

---

# Download Produk

Endpoint

```
GET /api/orders/:id/download
```

Flow

```
User

↓

Request Download

↓

Cek Login

↓

Cari Order

↓

Status == paid ?

↓

YES

↓

Generate Signed URL

↓

Return URL

↓

Download ZIP
```

Jika

```
status != paid
```

Return

```
403 Forbidden
```

---

# Signed URL

Gunakan Supabase Storage Signed URL.

Durasi misalnya

```
60 detik
```

atau

```
5 menit
```

Setelah expired user dapat meminta Signed URL baru.

Jangan menggunakan Public URL untuk file premium.

---

# Keamanan

Server wajib melakukan validasi:

- user login
- order milik user
- status sudah paid
- product masih aktif
- signature Midtrans valid

Frontend tidak boleh menentukan:

- harga
- order_id
- status pembayaran

Semua berasal dari server.

---

# API

## POST /api/payment

Request

```json
{
    "product_id": "uuid"
}
```

Response

```json
{
    "token": "...",
    "order_number": "...",
    "status": "pending"
}
```

---

## POST /api/midtrans/webhook

Dipanggil oleh Midtrans.

Tidak dipanggil frontend.

---

## GET /api/orders

Mengambil daftar order user.

---

## GET /api/orders/:id

Detail order.

---

## GET /api/orders/:id/download

Menghasilkan Signed URL apabila order telah dibayar.

---

# UI Flow

```
Product

↓

Klik Beli

↓

Popup Midtrans

↓

Pending

↓

Menunggu Pembayaran

↓

Webhook

↓

Status Paid

↓

Button berubah menjadi

Download
```

---

# Best Practice

- Gunakan UUID atau nomor order unik sebagai `order_id` Midtrans.
- Simpan seluruh respons transaksi Midtrans untuk kebutuhan audit.
- Jangan pernah menggunakan harga dari frontend.
- Jangan pernah mengekspos `MIDTRANS_SERVER_KEY`.
- Simpan file ZIP di bucket private.
- Gunakan Signed URL untuk setiap proses unduh.
- Setelah pembayaran berhasil, arahkan pengguna ke halaman **Order** atau **Library** agar mereka dapat mengunduh kembali produk kapan saja tanpa perlu menyimpan tautan unduhan.

---

# Acceptance Criteria

- [ ] User dapat membeli produk digital.
- [ ] Order otomatis dibuat di Supabase.
- [ ] Snap Token berhasil dibuat.
- [ ] Popup Midtrans muncul.
- [ ] Webhook memperbarui status order.
- [ ] Order berubah menjadi `paid` setelah pembayaran berhasil.
- [ ] User hanya dapat mengunduh jika status `paid`.
- [ ] File diunduh melalui Signed URL.
- [ ] Bucket Storage bersifat private.
- [ ] Tidak ada URL file premium yang dapat diakses tanpa otorisasi.