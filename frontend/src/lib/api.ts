const TOKEN_KEYS = ['access_token', 'accessToken', 'sakhtar_access_token'] as const;
const PRIMARY_TOKEN_KEY = 'access_token';
const COMPAT_TOKEN_KEY = 'accessToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  for (const key of TOKEN_KEYS) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value && value.trim()) return value;
  }
  return null;
}

export function setAccessToken(token: string): void {
  localStorage.setItem(PRIMARY_TOKEN_KEY, token);
  localStorage.setItem(COMPAT_TOKEN_KEY, token);
  sessionStorage.removeItem(PRIMARY_TOKEN_KEY);
  sessionStorage.removeItem(COMPAT_TOKEN_KEY);
  sessionStorage.removeItem('sakhtar_access_token');
}

export function clearAccessToken(): void {
  for (const key of TOKEN_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

const getBase = () => {
  const slug = window.location.pathname.split('/')[2];
  return slug ? `/api/t/${slug}` : '';
};

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { skipContentType?: boolean }
): Promise<T> {
  const base = getBase();
  const url = path.startsWith('http') ? path : `${base}${path}`;
  const token = getAccessToken();
  const headers: HeadersInit = {
    ...(options?.skipContentType ? {} : { 'Content-Type': 'application/json' }),
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

export async function apiUploadFormData<T = { avatarUrl: string }>(
  path: string,
  formData: FormData
): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    body: formData,
    skipContentType: true,
  });
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
