const getBase = () => {
  const slug = window.location.pathname.split('/')[2];
  return slug ? `/api/t/${slug}` : '';
};

export async function api<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const base = getBase();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || err.code || res.statusText);
  }
  return res.json();
}

export function apiGet<T = unknown>(path: string) {
  return api<T>(path, { method: 'GET' });
}

export function apiPost<T = unknown>(path: string, body?: object) {
  return api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T = unknown>(path: string, body: object) {
  return api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiDelete<T = unknown>(path: string) {
  return api<T>(path, { method: 'DELETE' });
}
