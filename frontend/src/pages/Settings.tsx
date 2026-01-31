/**
 * صفحهٔ تنظیمات — فقط برای OWNER (Admin).
 * دسترسی با ProtectedRoute و چک نقش در Layout محدود شده است.
 * مرجع: docs/specs/RBAC-PANELS.md, docs/specs/PRD-PANELS-USER-STORIES.md
 */
import { Link, useParams } from 'react-router-dom';
import { Users, GitBranch, Link2, CreditCard, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { ErrorPage } from '@/components/error-page';

export default function Settings() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { role, loading } = useAuth();
  const base = `/t/${tenantSlug}/app`;

  if (loading) {
    return (
      <div className="space-y-5">
        <h1 className="text-title-lg font-title">تنظیمات</h1>
        <div className="text-muted-foreground">در حال بارگذاری...</div>
      </div>
    );
  }

  if (role !== 'OWNER') {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="فقط مدیر (Admin) می‌تواند به این صفحه دسترسی داشته باشد."
        actionHref={base}
        actionLabel="برگشت به داشبورد"
        inline
      />
    );
  }

  const sections = [
    {
      id: 'users',
      title: 'مدیریت کاربران و نقش‌ها',
      description: 'افزودن و حذف کاربران، تعیین نقش (مدیر / فروشنده).',
      icon: Users,
      href: `${base}/settings/users`,
      comingSoon: false,
    },
    {
      id: 'pipeline',
      title: 'مراحل Pipeline',
      description: 'تعریف و ترتیب مراحل فروش (Pipeline و Stage).',
      icon: GitBranch,
      href: `${base}/settings/pipeline`,
      comingSoon: false,
    },
    {
      id: 'lead-sources',
      title: 'منابع لید',
      description: 'تعریف منابع ورود لید (سایت، تبلیغ، تماس).',
      icon: Link2,
      href: `${base}/settings/lead-sources`,
      comingSoon: false,
    },
    {
      id: 'billing',
      title: 'اشتراک و صورتحساب',
      description: 'وضعیت اشتراک، تعداد صندلی، فاکتورها.',
      icon: CreditCard,
      href: `${base}/settings/billing`,
      comingSoon: false,
    },
  ];

  return (
    <div className="space-y-5">
      <PageBreadcrumb current="تنظیمات" />
      <h1 className="text-title-lg font-title">تنظیمات</h1>
      <p className="text-muted-foreground text-sm">
        مدیریت کاربران، Pipeline، منابع لید و اشتراک. فقط برای مدیر Tenant.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className="glass-card rounded-card p-5 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-2 text-primary">
                  <Icon className="size-5" aria-hidden />
                </div>
                <h2 className="font-title text-base">{section.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{section.description}</p>
              {section.comingSoon ? (
                <span className="text-xs text-muted-foreground">به زودی</span>
              ) : (
                <Link
                  to={section.href}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-input bg-transparent px-3 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  مشاهده
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="glass-card rounded-card p-4 flex items-center gap-3 text-sm text-muted-foreground">
        <ShieldAlert className="size-5 shrink-0" aria-hidden />
        <span>این بخش فقط برای نقش مدیر (OWNER) در دسترس است.</span>
      </div>
    </div>
  );
}
