-- Keep Xendit routing and individual-name fields server controlled while the
-- seller only supplies bank code, account number, and account holder name.

CREATE OR REPLACE FUNCTION public.normalize_seller_payout_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bank_code text;
  v_account_number text;
  v_name_parts text[];
  v_min_length integer;
  v_max_length integer;
BEGIN
  IF NEW.bank_name IS NULL
     AND NEW.bank_account IS NULL
     AND NEW.payout_account_holder_name IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.bank_name IS NULL
     OR NEW.bank_account IS NULL
     OR NEW.payout_account_holder_name IS NULL THEN
    RAISE EXCEPTION 'bank code, account number, and account holder name are required together'
      USING ERRCODE = '23514';
  END IF;

  v_bank_code := upper(btrim(NEW.bank_name));
  v_bank_code := CASE v_bank_code
    WHEN 'ID_BCA' THEN 'BCA'
    WHEN 'BANK CENTRAL ASIA' THEN 'BCA'
    WHEN 'ID_BRI' THEN 'BRI'
    WHEN 'BANK RAKYAT INDONESIA' THEN 'BRI'
    WHEN 'ID_BNI' THEN 'BNI'
    WHEN 'BANK NEGARA INDONESIA' THEN 'BNI'
    WHEN 'ID_MANDIRI' THEN 'MANDIRI'
    WHEN 'BANK MANDIRI' THEN 'MANDIRI'
    WHEN 'ID_PERMATA' THEN 'PERMATA'
    WHEN 'PERMATABANK' THEN 'PERMATA'
    ELSE v_bank_code
  END;

  v_account_number := regexp_replace(NEW.bank_account, '[^0-9]', '', 'g');
  IF v_bank_code = 'BRI' AND length(v_account_number) = 14 THEN
    v_account_number := '0' || v_account_number;
  END IF;

  SELECT limits.min_length, limits.max_length
    INTO v_min_length, v_max_length
  FROM (VALUES
    ('BCA', 10, 10),
    ('BRI', 13, 17),
    ('BNI', 7, 11),
    ('MANDIRI', 12, 17),
    ('PERMATA', 7, 16)
  ) AS limits(bank_code, min_length, max_length)
  WHERE limits.bank_code = v_bank_code;

  IF v_min_length IS NULL THEN
    RAISE EXCEPTION 'unsupported payout bank code: %', v_bank_code
      USING ERRCODE = '23514';
  END IF;
  IF length(v_account_number) < v_min_length OR length(v_account_number) > v_max_length THEN
    RAISE EXCEPTION 'invalid account number length for bank %', v_bank_code
      USING ERRCODE = '23514';
  END IF;

  NEW.bank_name := v_bank_code;
  NEW.bank_account := v_account_number;
  NEW.payout_account_holder_name := regexp_replace(btrim(NEW.payout_account_holder_name), '\s+', ' ', 'g');
  v_name_parts := regexp_split_to_array(NEW.payout_account_holder_name, '\s+');

  NEW.payout_recipient_type := 'INDIVIDUAL';
  NEW.payout_given_name := left(v_name_parts[1], 50);
  NEW.payout_surname := left(
    CASE
      WHEN cardinality(v_name_parts) = 1 THEN v_name_parts[1]
      ELSE array_to_string(v_name_parts[2:cardinality(v_name_parts)], ' ')
    END,
    50
  );
  NEW.payout_business_name := NULL;
  NEW.payout_routing_type := 'SWIFT';
  NEW.payout_routing_value := CASE v_bank_code
    WHEN 'BCA' THEN 'CENAIDJA'
    WHEN 'BRI' THEN 'BRINIDJA'
    WHEN 'BNI' THEN 'BNINIDJA'
    WHEN 'MANDIRI' THEN 'BMRIIDJA'
    WHEN 'PERMATA' THEN 'BBBAIDJA'
  END;

  -- Kept only for compatibility with the payout readiness checks created in
  -- migration 0020. The Xendit request sends recipient.address.country = ID.
  NEW.payout_address_line_1 := 'Indonesia';
  NEW.payout_city := 'Indonesia';
  NEW.payout_province := 'Indonesia';
  NEW.payout_postal_code := '00000';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_seller_payout_account ON public.sellers;
CREATE TRIGGER normalize_seller_payout_account
  BEFORE INSERT OR UPDATE OF
    bank_name,
    bank_account,
    payout_account_holder_name,
    payout_recipient_type,
    payout_given_name,
    payout_surname,
    payout_business_name,
    payout_routing_type,
    payout_routing_value,
    payout_address_line_1,
    payout_city,
    payout_province,
    payout_postal_code
  ON public.sellers
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_seller_payout_account();
