let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const body = await response
    .json()
    .catch(() => ({
      detail: "The server is starting or unavailable. Try again shortly.",
    }));
  if (!response.ok) {
    const detail = body.detail;
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      typeof detail === "string"
        ? detail
        : detail?.message ||
            "Request failed. Check the selected values and try again.",
    );
  }
  return body;
}
export function query(values: Record<string, unknown>) {
  const q = new URLSearchParams();
  Object.entries(values).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== null && v !== "All")
      q.set(k, String(v));
  });
  return "?" + q.toString();
}
