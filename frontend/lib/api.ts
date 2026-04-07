const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * A helper function for making requests to the backend API (the routes)
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const user = process.env.NEXT_PUBLIC_API_USER;
  const pass = process.env.NEXT_PUBLIC_API_PASS;
  const encoded = btoa(`${user}:${pass}`);

  const headers = {
    ...options.headers,
    "Authorization": `Basic ${encoded}`,
  };

  const res = await fetch(`${API_URL}${path}`, {...options, headers});

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}