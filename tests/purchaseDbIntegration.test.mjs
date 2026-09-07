import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pathToFileURL } from 'node:url'

// Optional isolated PostgreSQL WASM runner; never connects to a real database.
// Set PURCHASE_TEST_PGLITE to the installed package's dist/index.js in a temp dir.
const packagePath = process.env.PURCHASE_TEST_PGLITE
test('real PostgreSQL purchase/download/refund lifecycle and privilege checks', { skip: !packagePath }, async () => {
  const { PGlite } = await import(pathToFileURL(packagePath).href)
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth,storage TO anon,authenticated,service_role;
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);
      CREATE TABLE profiles(id uuid PRIMARY KEY,role text DEFAULT 'user',full_name text DEFAULT 'Test');
      CREATE TABLE sellers(id uuid PRIMARY KEY,profile_id uuid,status text,commission_rate numeric);
      CREATE TABLE products(id bigint PRIMARY KEY,name text,status text,price int,seller_id uuid);
      CREATE TABLE product_licenses(id uuid PRIMARY KEY,product_id bigint,name text,price int,usage_terms text,is_active boolean,allow_commercial_use boolean,allow_resale boolean);
      CREATE TABLE orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid,order_number text,total_amount int,status text DEFAULT 'pending',created_at timestamptz DEFAULT now(),paid_at timestamptz,fulfilled_at timestamptz,invoice_creation_token uuid,invoice_creation_started_at timestamptz);
      CREATE TABLE order_items(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,order_id uuid,product_id bigint,price int,seller_id uuid,commission_rate_snapshot numeric,commission_amount int,seller_earning int,payout_status text DEFAULT 'pending',available_for_payout_at timestamptz,is_downloaded boolean DEFAULT false,downloaded_at timestamptz,download_count int NOT NULL DEFAULT 0);
      CREATE TABLE order_item_licenses(id uuid DEFAULT gen_random_uuid(),order_item_id bigint,product_license_id uuid,license_name_snapshot text,usage_terms_snapshot text,allow_commercial_use_snapshot boolean,allow_resale_snapshot boolean,price_snapshot int);
      CREATE TABLE user_products(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,profile_id uuid,product_id bigint,order_id uuid,created_at timestamptz DEFAULT now(),UNIQUE(profile_id,product_id));
      CREATE TABLE cart(id uuid PRIMARY KEY,profile_id uuid);
      CREATE TABLE cart_items(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,cart_id uuid,product_id bigint,product_license_id uuid);
      CREATE TABLE payments(id uuid DEFAULT gen_random_uuid(),order_id uuid,provider text,provider_invoice_id text,status text);
      CREATE TABLE download_logs(id uuid DEFAULT gen_random_uuid(),profile_id uuid,product_id bigint,downloaded_at timestamptz,ip_address inet,user_agent text);
      CREATE TABLE seller_payouts(id uuid PRIMARY KEY,status text,created_at timestamptz DEFAULT now());
      CREATE TABLE seller_payout_items(payout_id uuid,order_item_id bigint);
      CREATE TABLE seller_balance_adjustments(id uuid DEFAULT gen_random_uuid(),seller_id uuid,order_item_id bigint,amount int,reason text,reference_no text,source_payout_id uuid,status text,payout_id uuid,applied_at timestamptz,UNIQUE(order_item_id,reason));
      CREATE TABLE order_refund_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid UNIQUE,requested_by uuid,reason text,status text,provider_reference_id text,provider_refund_id text,provider_failure_code text,provider_response jsonb,submitted_at timestamptz,resolved_at timestamptz,updated_at timestamptz);
      CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean);
      CREATE TABLE storage.objects(id uuid,bucket_id text,name text);
      CREATE FUNCTION public.is_seller_platform_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT auth.role()='service_role' $$;
      CREATE FUNCTION public.record_activity(uuid,text,text,text,text,jsonb) RETURNS void LANGUAGE sql AS $$ SELECT $$;
      CREATE FUNCTION public.record_order_item_download(bigint,uuid,inet,text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
      SELECT set_config('request.jwt.claim.role','service_role',false);
    `)
    for (const file of ['0041_purchase_eligibility.sql', '0042_purchase_download_sessions.sql']) {
      await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
    }
    const buyer = '11111111-1111-4111-8111-111111111111'
    const login = '22222222-2222-4222-8222-222222222222'
    const license = '33333333-3333-4333-8333-333333333333'
    const otherLicense = '44444444-4444-4444-8444-444444444444'
    await db.query('INSERT INTO profiles(id) VALUES ($1)', [buyer])
    await db.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)', [login,buyer])
    await db.exec("INSERT INTO products VALUES (7,'Test product','published',10000,NULL)")
    for (const id of [license,otherLicense]) await db.query("INSERT INTO product_licenses VALUES($1,7,'Personal',10000,'Terms',true,false,false)",[id])
    const checkout = async (tier=license) => (await db.query('SELECT * FROM create_checkout_order($1,7,$2)',[buyer,tier])).rows[0]
    const first = await checkout()
    assert.equal(first.should_create_invoice,true)
    assert.equal((await checkout()).order_id,first.order_id)
    assert.equal((await checkout()).should_create_invoice,false)
    await assert.rejects(checkout(otherLicense),/product_payment_pending/)
    // A pre-upgrade second invoice can still settle later. Preserve the receipt,
    // withhold new access, and require refund rather than paying a seller twice.
    const duplicateOrder = crypto.randomUUID()
    await db.query("INSERT INTO orders(id,profile_id,order_number,total_amount) VALUES($1,$2,'LEGACY-DUPLICATE',10000)",[duplicateOrder,buyer])
    await db.query('INSERT INTO order_items(order_id,product_id,price) VALUES($1,7,10000)',[duplicateOrder])
    await db.query('SELECT finalize_paid_order($1,$2,now())',[first.order_id,buyer])
    const duplicate = (await db.query('SELECT finalize_paid_order($1,$2,now()) AS result',[duplicateOrder,buyer])).rows[0].result
    assert.equal(duplicate.requiresReconciliation,true)
    assert.equal(duplicate.grantedCount,0)
    await db.query('SELECT finalize_paid_order($1,$2,now())',[first.order_id,buyer])
    await assert.rejects(checkout(),/product_already_purchased/)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM user_products')).rows[0].n,1)
    const item = (await db.query('SELECT id FROM order_items WHERE order_id=$1',[first.order_id])).rows[0].id
    const ticket = async (itemId=item) => {
      // Unique token hash per ticket; start helper below takes the returned hash.
      const id = crypto.randomUUID()
      const hash = id.replaceAll('-','').repeat(2)
      await db.query("INSERT INTO purchase_download_sessions(id,order_item_id,profile_id,auth_session_id,token_hash,binding_hash,idempotency_key,storage_path,file_name) VALUES($1,$2,$3,$4,$5,$6,$7,'7/file.zip','file.zip')",[id,itemId,buyer,login,hash,'b'.repeat(64),crypto.randomUUID()])
      return {id,hash}
    }
    const consume = t => db.query('SELECT start_purchase_download($1,$2,$3) AS result',[t.id,t.hash,'b'.repeat(64)])
    const a = await ticket()
    assert.equal((await consume(a)).rows[0].result.download_count,1)
    await assert.rejects(consume(a),/download_session_used_or_expired/)
    assert.equal((await consume(await ticket())).rows[0].result.download_count,2)
    const pending = await Promise.all([ticket(),ticket(),ticket()])
    const attempts = await Promise.allSettled(pending.map(consume))
    assert.equal(attempts.filter(result=>result.status==='fulfilled').length,1)
    assert.equal((await db.query('SELECT download_count FROM order_items WHERE id=$1',[item])).rows[0].download_count,3)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM download_logs')).rows[0].n,3)
    await db.query('SELECT apply_order_refund($1)',[first.order_id])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM user_products')).rows[0].n,0)
    await assert.rejects(checkout(),/product_already_purchased/)
    await db.query('SELECT finalize_paid_order($1,$2,now())',[duplicateOrder,buyer])
    assert.equal((await db.query('SELECT count(*)::int AS n FROM user_products')).rows[0].n,0)
    await db.query('SELECT apply_order_refund($1)',[duplicateOrder])
    const second = await checkout()
    await db.query('SELECT finalize_paid_order($1,$2,now())',[second.order_id,buyer])
    await assert.rejects(consume(await ticket()),/purchase_access_revoked/)
    const secondItem = (await db.query('SELECT id,download_count FROM order_items WHERE order_id=$1',[second.order_id])).rows[0]
    assert.equal(secondItem.download_count,0)
    const expired = await ticket(secondItem.id)
    await db.query("UPDATE purchase_download_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id])
    await assert.rejects(consume(expired),/download_session_used_or_expired/)
    const wrongBinding = await ticket(secondItem.id)
    await assert.rejects(db.query('SELECT start_purchase_download($1,$2,$3)',[wrongBinding.id,wrongBinding.hash,'c'.repeat(64)]),/download_session_invalid/)
    const revoked = await ticket(secondItem.id)
    await db.query("UPDATE purchase_download_sessions SET status='revoked' WHERE id=$1",[revoked.id])
    await assert.rejects(consume(revoked),/download_session_used_or_expired/)
    const signedOut = await ticket(secondItem.id)
    await db.query('DELETE FROM auth.sessions WHERE id=$1',[login])
    await assert.rejects(consume(signedOut),/download_session_signed_out/)
    const privileges = (await db.query("SELECT has_table_privilege('authenticated','order_items','UPDATE') AS counter_write,has_table_privilege('authenticated','user_products','INSERT') AS mint_access,has_table_privilege('authenticated','purchase_download_sessions','SELECT') AS read_tickets,has_function_privilege('authenticated','start_purchase_download(uuid,text,text,inet,text)','EXECUTE') AS consume,has_function_privilege('service_role','record_order_item_download(bigint,uuid,inet,text)','EXECUTE') AS legacy")).rows[0]
    for (const granted of Object.values(privileges)) assert.equal(granted,false)
    await db.exec("SET ROLE authenticated; SELECT set_config('request.jwt.claim.role','authenticated',false)")
    await assert.rejects(db.query('UPDATE order_items SET download_count=0 WHERE id=$1',[secondItem.id]),/permission denied/)
    await assert.rejects(consume(signedOut),/permission denied/)
    await assert.rejects(db.query('SELECT record_order_item_download($1,$2,NULL,NULL)',[secondItem.id,buyer]),/permission denied/)
  } finally { await db.close() }
})
