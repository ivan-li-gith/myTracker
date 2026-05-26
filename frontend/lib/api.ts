const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  if (!API_URL) throw new Error("NEXT_PUBLIC_API_URL is not set — check .env.local and restart the dev server");
  const headers = authHeaders(options.headers as HeadersInit);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Retry once after a short delay to handle transient backend restarts
    await new Promise((r) => setTimeout(r, 1500));
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } catch (retryErr) {
      throw new Error(`Network error reaching ${API_URL}${path} — is the backend running? (${retryErr instanceof Error ? retryErr.message : retryErr})`);
    }
  }
  if (!res.ok) {
    let msg = `API error ${res.status} on ${options.method ?? "GET"} ${path}`;
    try {
      const body = await res.json();
      if (body?.detail) msg += `: ${typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)}`;
    } catch { /* ignore parse errors */ }
    throw new Error(msg);
  }
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