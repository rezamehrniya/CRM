const TOKEN_KEY = 'sakhtar_access_token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

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
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
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
