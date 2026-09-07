// Older clients must not obtain reusable signed URLs that bypass the quota.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  throw createError({ statusCode: 410, statusMessage: 'Use My Purchases to start a secure download.' });
});
