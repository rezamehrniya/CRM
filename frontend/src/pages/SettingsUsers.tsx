import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Shield, Users } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import { ErrorPage } from '@/components/error-page';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PermissionItem = {
  id: string;
  key: string;
  resource: string;
  action: string;
  description: string | null;
};

type RoleItem = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  memberCount: number;
  permissions: string[];
};

type MemberItem = {
  id: string;
  status: string;
  role: {
    id: string | null;
    key: string;
    name: string;
    permissions: string[];
  };
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    status: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
  };
};

type TabCode = 'members' | 'access';

function toDisplayName(member: MemberItem): string {
  const full = [member.user.firstName, member.user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();
  if (full) return full;
  if (member.user.displayName?.trim()) return member.user.displayName.trim();
  return member.user.email ?? member.user.phone ?? member.user.id;
}

export default function SettingsUsers() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { loading: authLoading, hasPermission } = useAuth();
  const canReadSettings = hasPermission('settings.read');
  const canReadUsers = hasPermission('users.read');
  const canWriteUsers = hasPermission('users.write');
  const canManageUsers = hasPermission('users.manage');
  const canAccess = canReadSettings && canReadUsers;
  const base = `/t/${tenantSlug}/app`;

  const [tab, setTab] = useState<TabCode>('members');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roleKey, setRoleKey] = useState('SALES_REP');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.key === roleKey) ?? null,
    [roleKey, roles],
  );

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, rolesRes, permissionsRes] = await Promise.all([
        apiGet<MemberItem[]>('/settings/members'),
        apiGet<RoleItem[]>('/settings/roles'),
        apiGet<PermissionItem[]>('/settings/permissions'),
      ]);
      setMembers(Array.isArray(membersRes) ? membersRes : []);
      const roleList = Array.isArray(rolesRes) ? rolesRes : [];
      setRoles(roleList);
      setPermissions(Array.isArray(permissionsRes) ? permissionsRes : []);
      if (roleList.length > 0 && !roleList.some((role) => role.key === roleKey)) {
        setRoleKey(roleList[0].key);
      }
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'خطا در دریافت اطلاعات کاربران');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canAccess) return;
    void loadAll();
  }, [canAccess]);

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddError(null);
    if (!email.trim() && !phone.trim()) {
      setAddError('ایمیل یا شماره تلفن الزامی است.');
      return;
    }
    if (password.trim().length < 8) {
      setAddError('رمز عبور اولیه باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    setAddSaving(true);
    try {
      await apiPost('/settings/members', {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        password: password.trim(),
        roleKey,
      });
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setPassword('');
      await loadAll();
    } catch (submitError: unknown) {
      setAddError(submitError instanceof Error ? submitError.message : 'خطا در افزودن عضو');
    } finally {
      setAddSaving(false);
    }
  };

  const changeRole = async (membershipId: string, nextRoleKey: string) => {
    try {
      await apiPatch(`/settings/members/${membershipId}/role`, { roleKey: nextRoleKey });
      setMembers((previous) =>
        previous.map((member) =>
          member.id === membershipId
            ? {
                ...member,
                role:
                  roles.find((role) => role.key === nextRoleKey)
                    ? {
                        id: roles.find((role) => role.key === nextRoleKey)?.id ?? null,
                        key: nextRoleKey,
                        name: roles.find((role) => role.key === nextRoleKey)?.name ?? nextRoleKey,
                        permissions:
                          roles.find((role) => role.key === nextRoleKey)?.permissions ?? member.role.permissions,
                      }
                    : member.role,
              }
            : member,
        ),
      );
    } catch (changeError: unknown) {
      setError(changeError instanceof Error ? changeError.message : 'خطا در تغییر نقش');
    }
  };

  if (authLoading) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  if (!canAccess) {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="برای مشاهده مدیریت کاربران دسترسی کافی ندارید."
        actionHref={`${base}/settings`}
        actionLabel="بازگشت به تنظیمات"
        inline
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to={`${base}/settings`} className="hover:text-foreground">
          تنظیمات
        </Link>
        <ArrowRight className="size-4" aria-hidden />
        <span className="text-foreground">مدیریت کاربران و دسترسی‌ها</span>
      </div>

      <h1 className="text-title-lg font-title">مدیریت کاربران و دسترسی‌ها</h1>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('members')}
            className={`inline-flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              tab === 'members'
                ? 'bg-primary text-primary-foreground'
                : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="size-4 ml-1" />
            اعضا
          </button>
          <button
            type="button"
            onClick={() => setTab('access')}
            className={`inline-flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
              tab === 'access'
                ? 'bg-primary text-primary-foreground'
                : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="size-4 ml-1" />
            مدیریت دسترسی‌ها
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-card p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : tab === 'members' ? (
        <div className="space-y-4">
          {canWriteUsers && (
            <div className="glass-card rounded-card p-5">
              <h2 className="font-title text-base mb-3">افزودن عضو</h2>
              <form onSubmit={addMember} className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="member-first-name">نام</Label>
                  <Input
                    id="member-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-last-name">نام خانوادگی</Label>
                  <Input
                    id="member-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-email">ایمیل</Label>
                  <Input
                    id="member-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-phone">شماره تلفن</Label>
                  <Input
                    id="member-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-password">رمز عبور اولیه</Label>
                  <Input
                    id="member-password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-role">نقش</Label>
                  <select
                    id="member-role"
                    value={roleKey}
                    onChange={(event) => setRoleKey(event.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-card px-3"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.key}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  {selectedRole && (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                      <p className="font-medium mb-2">دسترسی‌های نقش {selectedRole.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedRole.permissions.map((permissionKey) => (
                          <span
                            key={permissionKey}
                            className="rounded-full border border-border bg-background px-2 py-0.5"
                          >
                            {permissionKey}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="md:col-span-2 flex items-center justify-between gap-3">
                  {addError && <p className="text-sm text-destructive">{addError}</p>}
                  <Button type="submit" disabled={addSaving}>
                    {addSaving ? 'در حال افزودن...' : 'افزودن عضو'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="glass-card rounded-card p-5 overflow-x-auto">
            <h2 className="font-title text-base mb-3">اعضا</h2>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">هنوز عضوی ثبت نشده است.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-start p-2 font-medium">نام</th>
                    <th className="text-start p-2 font-medium">ایمیل / موبایل</th>
                    <th className="text-start p-2 font-medium">نقش</th>
                    <th className="text-start p-2 font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b border-border">
                      <td className="p-2">{toDisplayName(member)}</td>
                      <td className="p-2">{member.user.email ?? member.user.phone ?? '-'}</td>
                      <td className="p-2">
                        {canManageUsers ? (
                          <select
                            value={member.role.key}
                            onChange={(event) => void changeRole(member.id, event.target.value)}
                            className="h-9 rounded-lg border border-input bg-card px-2 text-xs"
                          >
                            {roles.map((role) => (
                              <option key={role.id} value={role.key}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          member.role.name
                        )}
                      </td>
                      <td className="p-2">{member.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="glass-card rounded-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="font-title text-base">{role.name}</h2>
                  <p className="text-xs text-muted-foreground">{role.description ?? role.key}</p>
                </div>
                <span className="text-xs rounded-full border border-border bg-muted/40 px-2 py-0.5">
                  {role.memberCount} عضو
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((permissionKey) => (
                  <span
                    key={permissionKey}
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-xs"
                  >
                    {permissionKey}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {roles.length === 0 && (
            <div className="glass-card rounded-card p-5 text-sm text-muted-foreground">
              هیچ نقشی یافت نشد.
            </div>
          )}
          {permissions.length > 0 && (
            <div className="glass-card rounded-card p-5">
              <h3 className="font-title text-sm mb-2">فهرست Permissionهای فعال</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {permissions.map((permission) => (
                  <div key={permission.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">
                    {permission.key}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
