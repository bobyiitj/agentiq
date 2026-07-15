/**
 * In-memory sliding window rate limiter.
 * ponytail: single-process only; multi-instance needs Redis. Fine for single-container deploys.
 */

interface RateLimitEntry {
  hits: number[];
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60s to prevent memory leaks from stale entries.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.hits = entry.hits.filter((t) => now - t < 300_000); // keep 5 min window
    if (entry.hits.length === 0) store.delete(key);
  }
}, 60_000);

export interface RateLimitConfig {
  /** Max requests allowed in the window. */
  maxRequests: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Optional: key derivation function. Defaults to IP-based. */
  keyFn?: (req: Request) => string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Check rate limit for a given key. Returns whether the request is allowed
 * and headers to send back.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { hits: [] };
    store.set(key, entry);
  }

  // Remove expired hits
  entry.hits = entry.hits.filter((t) => t > windowStart);

  const remaining = Math.max(0, config.maxRequests - entry.hits.length);
  const resetMs = entry.hits.length > 0
    ? config.windowMs - (now - entry.hits[0])
    : config.windowMs;

  if (entry.hits.length >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetMs };
  }

  entry.hits.push(now);
  return { allowed: true, remaining: remaining - 1, resetMs };
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ── Pre-configured tiers ──────────────────────────────────────────────

export const RATE_LIMIT_AUTH: RateLimitConfig = {
  maxRequests: Number(process.env.RATE_LIMIT_AUTH_MAX || "5"),
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || "900000"), // 15 min
};

export const RATE_LIMIT_API: RateLimitConfig = {
  maxRequests: Number(process.env.RATE_LIMIT_API_MAX || "60"),
  windowMs: Number(process.env.RATE_LIMIT_API_WINDOW_MS || "60000"), // 1 min
};

export const RATE_LIMIT_CHAT: RateLimitConfig = {
  maxRequests: Number(process.env.RATE_LIMIT_CHAT_MAX || "30"),
  windowMs: Number(process.env.RATE_LIMIT_CHAT_WINDOW_MS || "60000"), // 1 min
};

/**
 * Apply rate limit and return 429 response if exceeded.
 * Returns null if allowed.
 */
export function rateLimitOrReject(
  req: Request,
  config: RateLimitConfig,
  label: string,
): Response | null {
  const ip = getClientIp(req);
  const key = `${label}:${ip}`;
  const result = checkRateLimit(key, config);

  if (!result.allowed) {
    console.warn(`[rate-limit] ${label} blocked ip=${ip}`);
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(result.resetMs / 1000)),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  return null; // allowed
}
