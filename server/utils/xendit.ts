import crypto from 'node:crypto';
import {
  resolveXenditBankBeneficiary,
  resolveXenditRecipientAddress,
} from './xendit-beneficiary.js';

export type LocalPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';

export interface CreateXenditInvoiceInput {
  externalId: string;
  amount: number;
  description: string;
  customerEmail: string;
  customerName?: string;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  invoiceDurationSeconds?: number;
}

export interface XenditInvoice {
  id: string;
  external_id: string;
  invoice_url: string;
  status?: string;
  amount?: number | string;
  payer_email?: string | null;
  description?: string | null;
  payment_method?: string | null;
  payment_channel?: string | null;
  paid_at?: string | null;
  expiry_date?: string | null;
  success_redirect_url?: string | null;
  failure_redirect_url?: string | null;
  created?: string | null;
  updated?: string | null;
  [key: string]: any;
}

export interface XenditPayout {
  payout_id: string;
  status: string;
  reference_id: string;
  processor_reference?: string | null;
  source_currency?: string | null;
  source_amount?: number | null;
  destination_currency?: string | null;
  destination_amount?: number | null;
  failure_code?: string | null;
  created?: string | null;
  updated?: string | null;
  business_id?: string | null;
  [key: string]: any;
}

export interface CreateXenditPayoutInput {
  referenceId: string;
  idempotencyKey: string;
  amount: number;
  sellerId: string;
  bankCode: string;
  accountHolderName: string;
  accountNumber: string;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}

export class XenditApiError extends Error {
  statusCode: number;
  errorCode: string | null;
  payload: any;

  constructor(message: string, statusCode: number, errorCode: string | null, payload: any) {
    super(message);
    this.name = 'XenditApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.payload = payload;
  }

  get isDefinitiveClientError(): boolean {
    return this.statusCode >= 400
      && this.statusCode < 500
      && ![408, 409, 425, 429].includes(this.statusCode);
  }
}

const XENDIT_API_BASE_URL = 'https://api.xendit.co';

function getXenditAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

async function xenditFetch<T>(path: string, secretKey: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${XENDIT_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: getXenditAuthHeader(secretKey),
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.message || payload?.error_message || `Xendit request failed (${response.status})`;
    throw new XenditApiError(
      message,
      response.status,
      payload?.error_code || payload?.code || null,
      payload,
    );
  }

  return payload as T;
}

export async function createXenditInvoice(
  input: CreateXenditInvoiceInput,
  secretKey: string,
): Promise<XenditInvoice> {
  return xenditFetch<XenditInvoice>('/v2/invoices', secretKey, {
    method: 'POST',
    body: JSON.stringify({
      external_id: input.externalId,
      amount: input.amount,
      payer_email: input.customerEmail,
      description: input.description,
      currency: 'IDR',
      invoice_duration: input.invoiceDurationSeconds ?? 86400,
      success_redirect_url: input.successRedirectUrl,
      failure_redirect_url: input.failureRedirectUrl,
      should_send_email: false,
    }),
  });
}

export async function getXenditInvoice(invoiceId: string, secretKey: string): Promise<XenditInvoice> {
  return xenditFetch<XenditInvoice>(`/v2/invoices/${encodeURIComponent(invoiceId)}`, secretKey, {
    method: 'GET',
  });
}

export async function createXenditPayout(
  input: CreateXenditPayoutInput,
  secretKey: string,
): Promise<XenditPayout> {
  const beneficiary = resolveXenditBankBeneficiary({
    bankCode: input.bankCode,
    accountNumber: input.accountNumber,
    accountHolderName: input.accountHolderName,
  });
  const recipient: Record<string, any> = {
    type: beneficiary.recipientType,
    relationship: 'BUSINESS_PARTNER',
    account_details: {
      currency: 'IDR',
      account_country: 'ID',
      account_holder_name: beneficiary.accountHolderName,
      account_number: beneficiary.accountNumber,
      routing_type_1: beneficiary.routingType,
      routing_value_1: beneficiary.routingValue,
    },
    address: resolveXenditRecipientAddress(input),
    given_name: beneficiary.givenName,
    surname: beneficiary.surname,
  };

  return xenditFetch<XenditPayout>('/v3/payouts', secretKey, {
    method: 'POST',
    headers: {
      'Api-version': '2025-09-01',
      'Idempotency-key': input.idempotencyKey,
    },
    body: JSON.stringify({
      reference_id: input.referenceId,
      recipient,
      payout_details: {
        source_currency: 'IDR',
        source_amount: input.amount,
        destination_currency: 'IDR',
      },
      source_of_fund: 'BUSINESS_REVENUE',
      purpose_code: 'TRADES',
      description: `Weixies payout ${input.referenceId.slice(-12)}`,
      metadata: {
        seller_id: input.sellerId,
      },
    }),
  });
}

export async function getXenditPayout(payoutId: string, secretKey: string): Promise<XenditPayout> {
  return xenditFetch<XenditPayout>(`/v3/payouts/${encodeURIComponent(payoutId)}`, secretKey, {
    method: 'GET',
    headers: { 'Api-version': '2025-09-01' },
  });
}

export function normalizeXenditInvoiceStatus(status?: string | null): LocalPaymentStatus | null {
  switch (String(status ?? '').toUpperCase()) {
    case 'PAID':
    case 'SETTLED':
      return 'paid';
    case 'PENDING':
      return 'pending';
    case 'EXPIRED':
      return 'expired';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return null;
  }
}

export function verifyXenditCallbackToken(receivedToken: string, expectedToken: string): boolean {
  const received = String(receivedToken || '').trim();
  const expected = String(expectedToken || '').trim();

  if (!received || !expected || received.length !== expected.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch (error) {
    console.error('[Xendit] Callback token verification failed:', error);
    return false;
  }
}

export function parseOrderIdFromExternalId(externalId: string): string | null {
  const match = /^ORDER-(.+)$/.exec(String(externalId || '').trim());
  return match?.[1] || null;
}

