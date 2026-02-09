/**
 * نمایش نام کاربر (فروشنده/مسئول) — نام کامل یا fallback به موبایل.
 */
export type UserDisplaySource = {
  id?: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

export function getUserDisplayName(user: UserDisplaySource | null | undefined): string {
  if (!user) return '—';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.phone || '—';
}
