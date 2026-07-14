import { getMidtransSnapUrl } from '~/utils/midtrans';

export default defineNuxtPlugin(() => {
  if (!process.client) {
    return;
  }

  const config = useRuntimeConfig();
  const clientKey = String(config.public.midtransClientKey || process.env.MIDTRANS_CLIENT_KEY || '').trim();

  if (!clientKey) {
    console.warn('[Midtrans] MIDTRANS_CLIENT_KEY is not configured. Skipping Snap.js initialization.');
    return;
  }

  const existingScript = document.querySelector('script[data-midtrans-script]');
  if (existingScript) {
    return;
  }

  const script = document.createElement('script');
  const isProduction = config.public.midtransIsProduction;
  const snapUrl = getMidtransSnapUrl(isProduction);

  script.src = snapUrl;
  script.setAttribute('data-client-key', clientKey);
  script.setAttribute('data-midtrans-script', 'true');
  script.async = true;

  document.head.appendChild(script);
});
