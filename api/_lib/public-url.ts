import type { VercelRequest } from '@vercel/node';

export const getPublicBaseUrl = (req: VercelRequest) => {
  const hostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const forwardedProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];

  const host = hostHeader || process.env.APP_URL || process.env.VERCEL_URL;
  if (!host) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Unable to determine public base URL from headers or environment.');
    }
    return 'http://localhost:3000';
  }

  const protocol = forwardedProto && ['http', 'https'].includes(String(forwardedProto))
    ? String(forwardedProto)
    : host.includes('localhost') || host.includes('127.0.0.1')
      ? 'http'
      : 'https';

  if (/^https?:\/\//i.test(host)) {
    return host.replace(/\/$/, '');
  }

  return `${protocol}://${host}`.replace(/\/$/, '');
};
