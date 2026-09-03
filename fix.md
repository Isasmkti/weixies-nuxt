# Panduan untuk AI Agent: Mencegah Seller Membeli Produk Sendiri

## Masalah
Saat ini tidak ada validasi yang mencegah seller menambahkan produk toko sendiri ke cart, wishlist, atau checkout. Akibatnya proses checkout bisa error tanpa pesan yang jelas ke user. Perbaikan harus di 3 lapis: UI, backend/API, dan database (trigger sebagai jaring pengaman terakhir).

Konteks skema relevan: `products.seller_id -> sellers(id)`, `sellers.profile_id -> profiles(id)`, `orders.profile_id -> profiles(id)`, `order_items.seller_id`, `cart.profile_id`, `cart_items.cart_id/product_id`, `wishlists.profile_id/product_id`.

Cara cek kepemilikan: seller_id produk sama dengan seller milik user yang sedang login, yaitu ketika `products.seller_id = (SELECT id FROM sellers WHERE profile_id = current_user_id)`.

---

## 1. Lapis UI

### Halaman detail produk
- Fetch status kepemilikan saat load produk: bandingkan `product.seller_id` dengan seller_id milik user login (kalau user adalah seller).
- Kalau milik sendiri:
  - Sembunyikan tombol "Add to Cart" dan "Buy Now"
  - Tampilkan badge/notice: "Ini produk dari toko kamu sendiri" dengan tombol sekunder "Kelola Produk Ini" yang mengarah ke halaman edit produk seller
  - Tombol wishlist (♥) juga disembunyikan/disabled dengan alasan sama

### Halaman Cart
- Saat render cart, validasi ulang tiap `cart_items` terhadap kepemilikan (bukan hanya andalkan validasi saat add-to-cart, karena kepemilikan bisa berubah setelah item masuk cart — misal user baru daftar jadi seller belakangan, atau produk pindah tangan).
- Item yang ternyata milik sendiri: tampilkan dengan visual berbeda (border merah/warning, teks "Tidak bisa dibeli — ini produk toko kamu"), sediakan tombol "Hapus" khusus item itu.
- Disable tombol "Checkout" total selama masih ada item bermasalah di cart, dengan pesan ringkas di atas tombol: "Hapus produk milik toko kamu sendiri sebelum checkout."

### Halaman Wishlist
- Sama seperti cart: tandai item yang ternyata produk sendiri, sembunyikan tombol "Add to Cart" dari situ, cukup biarkan tombol hapus.

---

## 2. Lapis Backend/API — WAJIB, jangan mengandalkan UI saja

Validasi ulang di setiap endpoint berikut. Semua harus mengembalikan error message yang jelas dan bisa ditampilkan langsung ke user (bukan error generik/500).

### `POST /cart/items` (add to cart)
Sebelum insert ke `cart_items`, cek:
```
seller_id_of_product = SELECT seller_id FROM products WHERE id = :product_id
own_seller_id = SELECT id FROM sellers WHERE profile_id = :current_user_id
IF seller_id_of_product == own_seller_id: REJECT
```
Response error: `403` dengan pesan `"Kamu tidak bisa menambahkan produk toko sendiri ke keranjang."`

### `POST /wishlists` (add to wishlist)
Validasi sama seperti di atas. Pesan: `"Kamu tidak bisa menambahkan produk toko sendiri ke wishlist."`

### `POST /orders` / proses checkout (paling kritis)
Jangan percaya isi cart yang sudah tersimpan begitu saja. Sebelum membuat order:
1. Loop semua item di cart yang akan di-checkout
2. Untuk tiap item, validasi ulang kepemilikan (query fresh ke DB, bukan dari cache/state lama)
3. Kalau ditemukan pelanggaran, **batalkan seluruh proses checkout** (jangan partial-checkout hanya exclude item bermasalah tanpa konfirmasi user), kembalikan response berisi daftar produk mana saja yang bermasalah supaya frontend bisa highlight item spesifik itu di cart

Response error contoh:
```json
{
  "error": "self_purchase_not_allowed",
  "message": "Checkout dibatalkan. Beberapa produk di keranjang adalah milik toko kamu sendiri.",
  "conflicting_product_ids": [123, 456]
}
```

---

## 3. Lapis Database — jaring pengaman terakhir

Tambahkan trigger di `order_items` supaya insert gagal keras kalau lolos dari validasi application layer (bug, race condition, direct DB access, dsb).

```sql
CREATE OR REPLACE FUNCTION prevent_self_purchase()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sellers s
    JOIN orders o ON o.id = NEW.order_id
    WHERE s.id = NEW.seller_id
      AND s.profile_id = o.profile_id
  ) THEN
    RAISE EXCEPTION 'Seller tidak dapat membeli produk toko sendiri (order_id: %, product_id: %)', NEW.order_id, NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_self_purchase
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION prevent_self_purchase();
```

Catatan penting:
- Trigger ini akan melempar exception Postgres mentah kalau tertembus — pastikan lapis backend (bagian 2) menangkap exception ini dan mengubahnya jadi response API yang rapi, jangan biarkan stack trace/500 mentah sampai ke user. Ini alasan kenapa validasi di lapis 2 tetap wajib ada meski trigger sudah terpasang — trigger itu jaring pengaman, bukan pengganti validasi utama.
- Opsional tapi disarankan: tambahkan trigger serupa (atau CHECK di level aplikasi) untuk `cart_items` dan `wishlists` juga, supaya data yang "kotor" tidak sempat tersimpan sama sekali walau dari jalur mana pun.

---

## 4. Test yang wajib ditulis
- [ ] Seller tidak bisa add-to-cart produk sendiri → response 403 dengan pesan jelas
- [ ] Seller tidak bisa add-to-wishlist produk sendiri
- [ ] Item yang sudah kadung ada di cart sebelum user jadi seller → tervalidasi ulang saat render cart & saat checkout, bukan hanya saat add
- [ ] Checkout dengan campuran produk sendiri + produk orang lain → seluruh checkout gagal dengan daftar produk bermasalah, bukan partial success
- [ ] Insert langsung ke `order_items` lewat service role dengan kombinasi seller=buyer → trigger DB menolak dengan exception, dan itu tertangani jadi response API yang rapi (bukan 500 mentah)