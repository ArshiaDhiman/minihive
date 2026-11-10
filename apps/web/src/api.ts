const API_URL = "http://localhost:3000";

type Options = { method?: "GET" | "POST" | "DELETE"; body?: unknown };

// Adds the bearer token, throws with the API's error message on non-2xx
export async function api<T>(path: string, accessToken: string, options: Options = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = Array.isArray(error?.message) ? error.message.join(", ") : error?.message;
    throw new Error(message ?? `${response.status} ${response.statusText}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
