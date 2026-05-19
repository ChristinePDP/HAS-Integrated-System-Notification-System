// Very small, simple in-memory rate limiter (per-IP).
// Purpose: keep it minimal for learning and basic DoS protection.
export default function rateLimiter(opts = {}) {
  const windowMs = opts.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS) ?? 60_000;
  const maxRequests = opts.max ?? Number(process.env.RATE_LIMIT_MAX_REQUESTS) ?? 10;

  const hits = new Map();

  // Periodic cleanup to avoid unbounded memory growth
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetTime <= now) hits.delete(key);
  }, Math.max(10_000, Math.floor(windowMs)));

  return function limiter(req, res, next) {
    try {
      const ip = (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').toString().split(',')[0].trim();
      const now = Date.now();

      const entry = hits.get(ip);
      if (!entry || now > entry.resetTime) {
        hits.set(ip, { count: 1, resetTime: now + windowMs });
      } else {
        entry.count += 1;
      }

      const current = hits.get(ip);
      const remaining = Math.max(0, maxRequests - current.count);

      // Basic response headers (helpful but optional)
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(remaining));

      if (current.count > maxRequests) {
        const retryAfter = Math.ceil((current.resetTime - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ success: false, message: 'Too many requests', code: 'RATE_LIMIT_EXCEEDED', retryAfter: `${retryAfter}s` });
      }

      return next();
    } catch (err) {
      // On error, allow the request rather than blocking legitimate traffic
      console.error('rateLimiter error:', err);
      return next();
    }
  };
}
