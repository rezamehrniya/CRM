/**
 * صفحهٔ جزئیات کار — عنوان، تاریخ، وضعیت، لینک مخاطب/معامله.
 */
import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, CheckSquare, User, HandCoins, ArrowRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { getUserDisplayName } from '@/lib/user-display';
import { JalaliDate } from '@/components/ui/jalali-date';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPage } from '@/components/error-page';

type TaskDetailData = {
  id: string;
  title: string;
  dueAt?: string | null;
  status: string;
  contact?: { id: string; firstName: string; lastName: string } | null;
  deal?: { id: string; title: string } | null;
  assignedTo?: { id: string; phone: string | null; firstName: string | null; lastName: string | null } | null;
};

export default function TaskDetail() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const base = `/t/${tenantSlug}/app`;
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<TaskDetailData>(`/tasks/${id}`)
      .then(setTask)
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <ErrorPage
        variant="404"
        title="کار یافت نشد"
        description="شناسهٔ کار معتبر نیست."
        actionHref={`${base}/tasks`}
        actionLabel="برگشت به کارها"
        inline
      />
    );
  }

  if (error && !task) {
    return (
      <div className="space-y-5">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link to={base}>پنل</Link>
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          <Link to={`${base}/tasks`}>کارها</Link>
        </nav>
        <ErrorPage
          variant="404"
          title="کار یافت نشد"
          description={error}
          actionHref={`${base}/tasks`}
          actionLabel="برگشت به کارها"
          inline
        />
      </div>
    );
  }

  const statusLabel = task?.status === 'DONE' ? 'انجام‌شده' : 'باز';

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1" aria-label="مسیر">
        <Link to={base} className="hover:text-foreground transition-colors">
          پنل
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <Link to={`${base}/tasks`} className="hover:text-foreground transition-colors">
          کارها
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium truncate max-w-[180px]">
          {loading ? '…' : task?.title ?? 'کار'}
        </span>
      </nav>

      {loading ? (
        <div className="glass-card rounded-card p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : task ? (
        <>
          <div className="glass-card rounded-card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-3 text-primary">
                  <CheckSquare className="size-6" aria-hidden />
                </div>
                <div>
                  <h1 className="text-title-lg font-title">{task.title}</h1>
                  <p className="text-sm text-muted-foreground">کار</p>
                </div>
              </div>
              <Link
                to={`${base}/tasks`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
              >
                برگشت به لیست
              </Link>
            </div>

            <dl className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <dt className="text-xs text-muted-foreground">وضعیت</dt>
                <dd>{statusLabel}</dd>
              </div>
              {task.dueAt && (
                <div className="flex items-center gap-3">
                  <dt className="text-xs text-muted-foreground">موعد</dt>
                  <dd><JalaliDate value={task.dueAt} dateOnly /></dd>
                </div>
              )}
              {task.contact && (
                <div className="flex items-center gap-3">
                  <User className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">مخاطب</dt>
                    <dd>
                      <Link to={`${base}/contacts/${task.contact.id}`} className="font-medium text-primary hover:underline">
                        {[task.contact.firstName, task.contact.lastName].filter(Boolean).join(' ').trim() || '—'}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
              {task.deal && (
                <div className="flex items-center gap-3">
                  <HandCoins className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">معامله</dt>
                    <dd>
                      <Link to={`${base}/deals/${task.deal.id}`} className="font-medium text-primary hover:underline">
                        {task.deal.title}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <User className="size-5 text-muted-foreground shrink-0" aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">مسئول</dt>
                  <dd>{getUserDisplayName(task.assignedTo)}</dd>
                </div>
              </div>
            </dl>
          </div>

          <Link
            to={`${base}/tasks`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            <ArrowRight className="size-4" aria-hidden />
            برگشت به کارها
          </Link>
        </>
      ) : null}
    </div>
  );
}
