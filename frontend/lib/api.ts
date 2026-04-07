const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * A helper function for making requests to the backend API (the routes)
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}