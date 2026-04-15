const API_URL = process.env.NEXT_PUBLIC_API_URL;

function authHeaders(extra: HeadersInit = {}): Record<string, string> {
  const user = process.env.NEXT_PUBLIC_API_USER;
  const pass = process.env.NEXT_PUBLIC_API_PASS;
  const encoded = btoa(`${user}:${pass}`);
  return { ...(extra as Record<string, string>), Authorization: `Basic ${encoded}` };
}

/**
 * A helper function for making requests to the backend API (the routes)
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = authHeaders(options.headers as HeadersInit);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

/** Like apiFetch but returns the raw Response (for binary downloads). */
export async function apiFetchRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = authHeaders(options.headers as HeadersInit);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res;
}