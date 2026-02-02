/**
 * صفحهٔ پروفایل کاربر — نام و نام خانوادگی (اجباری)، آواتار (اختیاری)، شماره تلفن (فقط نمایش)، تغییر رمز عبور.
 * پس از اولین ورود کاربر باید نام و نام خانوادگی را تکمیل کند.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiPatch, apiPost, apiUploadFormData } from '@/lib/api';
import { digitsToFa } from '@/lib/numbers';
import { useAuth } from '@/contexts/auth-context';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Profile() {
  const [searchParams] = useSearchParams();
  const isCompleteFlow = searchParams.get('complete') === '1';
  const { user, refetch } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName ?? '');
      setLastName(user.lastName ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
    }
  }, [user]);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('فقط تصاویر (مثلاً JPEG، PNG، GIF، WebP) مجاز است.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('حداکثر حجم تصویر ۲ مگابایت است.');
      return;
    }
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await apiUploadFormData<{ avatarUrl: string }>('/auth/me/avatar', formData);
      setAvatarUrl(res.avatarUrl);
      await refetch();
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : 'خطا در آپلود آواتار');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setProfileError('نام و نام خانوادگی اجباری است.');
      return;
    }
    setProfileError(null);
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      await apiPatch('/auth/me', {
        firstName: fn,
        lastName: ln,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setProfileSuccess(true);
      await refetch();
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'خطا در ذخیره');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword !== confirmPassword) {
      setPasswordError('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('رمز عبور جدید حداقل ۸ کاراکتر باشد.');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiPost('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'خطا در تغییر رمز عبور');
    } finally {
      setPasswordSaving(false);
    }
  };

  const displayLabel = ([user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.email?.split('@')[0]
    || user?.phone) ?? 'کاربر';
  const initial = (displayLabel || 'پ').charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <PageBreadcrumb current="پروفایل" />
      <h1 className="text-title-lg font-title">پروفایل</h1>

      {isCompleteFlow && (
        <Alert className="rounded-card border-primary/40 bg-primary/10 text-foreground">
          <AlertDescription>
            لطفاً نام و نام خانوادگی خود را وارد کنید تا بتوانید از پنل استفاده کنید.
          </AlertDescription>
        </Alert>
      )}

      {/* نام، نام خانوادگی (اجباری) و آواتار (اختیاری) */}
      <section className="glass-card rounded-card p-6 max-w-lg">
        <h2 className="text-base font-semibold mb-4">اطلاعات نمایشی</h2>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex flex-col items-center gap-2">
            {avatarUrl.trim() ? (
              <img
                src={avatarUrl}
                alt="آواتار"
                className="w-24 h-24 rounded-full object-cover border-2 border-[var(--border-default)]"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full bg-primary/15 border-2 border-primary/25 flex items-center justify-center text-2xl font-medium text-primary"
                aria-hidden
              >
                {initial}
              </div>
            )}
            <Label htmlFor="avatarFile" className="text-xs text-muted-foreground">
              آپلود تصویر آواتار (اختیاری)
            </Label>
            <input
              id="avatarFile"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="flex w-full max-w-[16rem] rounded-xl border border-[var(--border-default)] bg-[var(--bg-default)] px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
              onChange={handleAvatarFile}
              disabled={avatarUploading}
            />
            {avatarUploading && <span className="text-xs text-muted-foreground">در حال آپلود...</span>}
            {avatarError && (
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div className="space-y-2">
              <Label htmlFor="firstName">نام <span className="text-destructive">*</span></Label>
              <Input
                id="firstName"
                type="text"
                placeholder="نام"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-card"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">نام خانوادگی <span className="text-destructive">*</span></Label>
              <Input
                id="lastName"
                type="text"
                placeholder="نام خانوادگی"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-card"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>شماره تلفن</Label>
              <Input
                type="text"
                value={user?.phone != null && user.phone !== '' ? digitsToFa(user.phone) : '—'}
                readOnly
                disabled
                className="bg-[var(--bg-muted)] text-muted-foreground cursor-not-allowed fa-num"
              />
              <p className="text-xs text-muted-foreground">
                شماره تلفن برای همگام‌سازی قابل تغییر نیست.
              </p>
            </div>
            {profileError && (
              <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            )}
            {profileSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">ذخیره شد.</p>
            )}
            <Button
              type="button"
              onClick={handleSaveProfile}
              disabled={profileSaving || !firstName.trim() || !lastName.trim()}
            >
              {profileSaving ? 'در حال ذخیره...' : isCompleteFlow ? 'ذخیره و ادامه' : 'ذخیره'}
            </Button>
          </div>
        </div>
      </section>

      {/* تغییر رمز عبور */}
      <section className="glass-card rounded-card p-6 max-w-lg">
        <h2 className="text-base font-semibold mb-4">تغییر رمز عبور</h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="رمز عبور فعلی"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">رمز عبور جدید</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="حداقل ۸ کاراکتر"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="bg-card"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تکرار رمز عبور جدید</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="تکرار رمز عبور جدید"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="bg-card"
            />
          </div>
          {passwordError && (
            <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
              <AlertDescription>{passwordError}</AlertDescription>
            </Alert>
          )}
          {passwordSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">رمز عبور با موفقیت تغییر کرد.</p>
          )}
          <Button type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'در حال تغییر...' : 'تغییر رمز عبور'}
          </Button>
        </form>
      </section>
    </div>
  );
}
