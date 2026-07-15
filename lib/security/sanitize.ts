/**
 * Sanitize error messages before sending to clients.
 * Never leak stack traces, internal paths, or provider internals.
 */

/** Patterns that indicate internal/sensitive information. */
const INTERNAL_PATTERNS = [
  /node_modules/i,
  /\.next/i,
  /C:\\/i,
  /\/home\//i,
  /\/var\//i,
  /\/usr\//i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /certificate/i,
  /TLS/i,
  /ssl/i,
  /localhost:\d+/i,
  /127\.0\.0\.1/i,
  /10\.\d+\.\d+\.\d+/i,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i,
  /192\.168\.\d+\.\d+/i,
];

/**
 * Return a safe error message for the client.
 * Full error is logged server-side only.
 */
export function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  // Log full error for debugging
  console.error("[server-error]", raw);

  // Check if the message leaks internal details
  for (const pattern of INTERNAL_PATTERNS) {
    if (pattern.test(raw)) {
      return "An internal error occurred. Please try again later.";
    }
  }

  // Known safe messages (from our own code)
  const safePrefixes = [
    "API key validation failed",
    "Invalid input",
    "Email already registered",
    "Registration failed",
    "Unknown provider",
    "Not found",
    "Forbidden",
    "Unauthorized",
    "Too many requests",
  ];
  for (const prefix of safePrefixes) {
    if (raw.startsWith(prefix)) return raw;
  }

  // Unknown error — return generic message
  return "An internal error occurred. Please try again later.";
}

/**
 * Create a standardized error JSON response.
 */
export function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Sanitize Zod error flatten output — only return field-level messages,
 * not the full schema structure.
 */
export function sanitizeZodError(zodError: any): Record<string, string[]> {
  const flat = zodError.flatten();
  const sanitized: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(flat.fieldErrors as Record<string, string[]>)) {
    sanitized[field] = messages;
  }
  if (flat.formErrors?.length) {
    sanitized._form = flat.formErrors;
  }
  return sanitized;
}
