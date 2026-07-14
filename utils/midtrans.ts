export function resolveMidtransIsProduction(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return ['true', '1', 'yes', 'y', 'prod', 'production', 'live', 'real'].includes(normalized);
}

export function getMidtransSnapUrl(isProduction: boolean): string {
  return isProduction
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
}

export function getMidtransSnapApiUrl(isProduction: boolean): string {
  return isProduction
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}

export function getMidtransAuthorizationHeader(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
}
