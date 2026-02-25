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

export function extractAccessToken(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const direct =
    record.accessToken ??
    record.access_token ??
    record.token ??
    (typeof record.data === 'object' && record.data
      ? (record.data as Record<string, unknown>).accessToken ??
        (record.data as Record<string, unknown>).access_token ??
        (record.data as Record<string, unknown>).token
      : null);
  return typeof direct === 'string' && direct.trim() ? direct : null;
}

const getBase = () => {
  const slug = window.location.pathname.split('/')[2];
  return slug ? `/api/t/${slug}` : '';
};

const shouldSkipRefresh = (url: string) =>
  url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');

async function tryRefresh(base: string): Promise<boolean> {
  const res = await fetch(`${base}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  const token = extractAccessToken(data);
  if (token) {
    setAccessToken(token);
    return true;
  }
  return false;
}

export async function api<T = unknown>(
  path: string,
  options?: RequestInit & { skipContentType?: boolean; _retried?: boolean }
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
  if (res.status === 401 && !options?._retried && !shouldSkipRefresh(url)) {
    const refreshed = await tryRefresh(base);
    if (refreshed) {
      return api<T>(path, { ...options, _retried: true });
    }
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let parsed: Record<string, unknown> | null = null;
    if (raw.trim()) {
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
    }
    const message =
      (parsed?.message as string | undefined) ||
      (parsed?.code as string | undefined) ||
      raw.trim() ||
      res.statusText ||
      `HTTP_${res.status}`;
    throw new Error(message);
  }
  return res.json();
}

/** آپلود فایل (مثلاً آواتار) با FormData. body باید FormData باشد و skipContentType استفاده می‌شود. */
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
