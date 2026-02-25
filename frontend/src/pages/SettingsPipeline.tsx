/**
 * زیرصفحهٔ تنظیمات: مراحل Pipeline — فقط OWNER.
 * مرجع: docs/specs/RBAC-PANELS.md
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GitBranch, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { apiGet } from '@/lib/api';
import { formatFaNum } from '@/lib/numbers';
import { ErrorPage } from '@/components/error-page';
import { Skeleton } from '@/components/ui/skeleton';

type PipelineStage = {
  id: string;
  name: string;
  order: number;
};

type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  stages: PipelineStage[];
};

export default function SettingsPipeline() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { hasPermission, loading: authLoading } = useAuth();
  const canAccessSettings = hasPermission('settings.read');
  const base = `/t/${tenantSlug}/app`;
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canAccessSettings) return;
    apiGet<Pipeline[]>('/pipelines')
      .then((data) => setPipelines(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [canAccessSettings]);

  if (authLoading) {
    return <div className="text-muted-foreground">در حال بارگذاری...</div>;
  }

  if (!canAccessSettings) {
    return (
      <ErrorPage
        variant="403"
        title="دسترسی غیرمجاز"
        description="فقط مدیر می‌تواند به مراحل Pipeline دسترسی داشته باشد."
        actionHref={`${base}/settings`}
        actionLabel="برگشت به تنظیمات"
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
        <span className="text-foreground">مراحل Pipeline</span>
      </div>
      <h1 className="text-title-lg font-title">مراحل Pipeline</h1>

      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="glass-card rounded-card p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : pipelines.length === 0 ? (
        <div className="glass-card rounded-card p-5">
          <p className="text-sm text-muted-foreground">هنوز Pipeline‌ای تعریف نشده است.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((p) => (
            <div key={p.id} className="glass-card rounded-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="size-5 text-primary" aria-hidden />
                <h2 className="font-title text-base">{p.name}</h2>
                {p.isDefault && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                    پیش‌فرض
                  </span>
                )}
              </div>
              {p.stages.length === 0 ? (
                <p className="text-sm text-muted-foreground">بدون مرحله</p>
              ) : (
                <ol className="flex flex-wrap gap-2">
                  {p.stages.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="rounded-lg border border-border bg-muted/40 px-2 py-1 text-sm fa-num">
                        {formatFaNum(s.order)}. {s.name}
                      </span>
                      {i < p.stages.length - 1 && (
                        <span className="text-muted-foreground">←</span>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      <Link
        to={`${base}/settings`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        برگشت به تنظیمات
      </Link>
    </div>
  );
}
