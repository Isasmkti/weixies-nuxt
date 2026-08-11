import crypto from 'node:crypto';

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
    throw new Error(message);
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

