# Database Migration - Digital Product Marketplace (Supabase)

## Objective

Implement new database tables to support a digital marketplace using:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage (Private Bucket)
- Midtrans Payment Gateway
- Digital Products (.zip)

Do **NOT** modify existing tables unless specified.

---

# Existing Tables

Already available:

- profiles
- products
- product_images
- categories
- product_categories
- cart
- cart_items
- wishlists
- reviews

---

# New Tables

## 1. orders

Purpose:
Store checkout transactions.

Columns:

- id (uuid, primary key, gen_random_uuid())
- profile_id (uuid, FK -> profiles.id)
- order_number (text, unique)
- total_amount (integer)
- status (text)

Allowed values:

- pending
- paid
- failed
- expired
- cancelled
- refunded
- partially_refunded
- chargeback

Additional columns:

- payment_method (text)
- midtrans_order_id (text, unique)
- midtrans_transaction_id (text, unique)
- snap_token (text)
- snap_redirect_url (text)
- created_at (timestamptz)
- paid_at (timestamptz)
- expired_at (timestamptz)

Enable RLS.

---

## 2. order_items

Purpose:

Store purchased products inside an order.

Columns

- id (bigint identity)
- order_id (FK -> orders.id)
- product_id (FK -> products.id)
- price (integer)

Enable RLS.

---

## 3. user_products

Purpose

Represents purchased products owned by a user.

Columns

- id (uuid)
- profile_id (FK -> profiles.id)
- product_id (FK -> products.id)
- order_id (FK -> orders.id)
- created_at

Constraints

Unique:

(profile_id, product_id)

Enable RLS.

---

## 4. payments

Purpose

Store Midtrans callback history.

Columns

- id (uuid)
- order_id (FK -> orders.id)
- midtrans_transaction_id
- payment_type
- gross_amount
- transaction_status
- fraud_status
- raw_response (jsonb)
- created_at

Enable RLS.

---

## 5. download_logs

Purpose

Track every download.

Columns

- id (uuid)
- profile_id (FK -> profiles.id)
- product_id (FK -> products.id)
- downloaded_at
- ip_address (inet)
- user_agent

Enable RLS.

---

## 6. coupons

Purpose

Discount codes.

Columns

- id (uuid)
- code (unique)
- discount (integer)
- max_usage
- used_count
- expired_at
- created_at

Enable RLS.

---

## 7. coupon_usages

Purpose

Track coupon usage.

Columns

- id (uuid)
- coupon_id (FK -> coupons.id)
- profile_id (FK -> profiles.id)
- order_id (FK -> orders.id)
- used_at

Constraint

Unique

(coupon_id, profile_id)

Enable RLS.

---

## 8. product_files

Purpose

Store downloadable files.

Do NOT use products.file_url anymore.

Columns

- id (uuid)
- product_id (FK -> products.id)
- file_name
- file_url
- file_size
- version
- created_at

Enable RLS.

---

# Indexes

Create indexes:

orders.profile_id

order_items.order_id

user_products.profile_id

user_products.product_id

payments.order_id

product_files.product_id

---

# Row Level Security

The project already has:

profiles.role

Enum:

- admin
- user
- seller

Seller is not used yet.

Only implement policies for:

- admin
- user

---

## Admin Policy

Every new table must have:

```sql
CREATE POLICY "Admin full access"
ON table_name
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);
```

Replace `table_name` accordingly.

---

## User Policies

### orders

Users can only:

- SELECT
- INSERT
- UPDATE

their own orders.

Condition:

```sql
profile_id = auth.uid()
```

---

### order_items

Users may only access items belonging to their own orders.

Join through:

orders.profile_id

---

### user_products

Users can only SELECT their own purchased products.

No INSERT.

No DELETE.

---

### payments

Users can only SELECT payments belonging to their own orders.

---

### download_logs

Users can

SELECT

INSERT

their own logs.

---

### coupons

Everyone can SELECT coupons.

Only admin may modify.

---

### coupon_usages

Users may

SELECT

INSERT

their own usages.

---

### product_files

Users can SELECT only when they own the product.

Use EXISTS:

```sql
SELECT 1
FROM user_products
WHERE
user_products.profile_id = auth.uid()
AND user_products.product_id = product_files.product_id
```

Only admin may INSERT/UPDATE/DELETE.

---

# Storage

Product ZIP files must be stored inside a **private Supabase Storage bucket**.

Never expose public URLs.

Download flow:

1. User purchases product.
2. Midtrans webhook marks order as paid.
3. Insert into user_products.
4. User requests download.
5. Verify ownership using user_products.
6. Generate a temporary Signed URL.
7. Return Signed URL.

---

# Midtrans Flow

Checkout

↓

Create Order

status = pending

↓

Create Snap Transaction

↓

User Pays

↓

Webhook

↓

Update orders.status = paid

↓

Insert payments

↓

Insert user_products

↓

User gains download access

---

# Requirements

- Use PostgreSQL best practices.
- Use foreign keys.
- Use ON DELETE CASCADE where appropriate.
- Enable Row Level Security on every new table.
- Create all indexes.
- Create all RLS policies.
- Produce clean migration SQL.
- Do not modify existing schema except removing `products.file_url` if migrating to `product_files`.
