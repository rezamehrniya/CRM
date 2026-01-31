/**
 * صفحهٔ جزئیات مخاطب — مشاهده یک مخاطب با لینک برگشت به لیست.
 */
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Phone, Mail, Building2, ArrowRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { PageBreadcrumb } from '@/components/PageBreadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorPage } from '@/components/error-page';

type Contact = {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
};

export default function ContactDetail() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const navigate = useNavigate();
  const base = `/t/${tenantSlug}/app`;
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiGet<Contact>(`/contacts/${id}`)
      .then(setContact)
      .catch((e) => setError(e?.message ?? 'خطا'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id) {
    return (
      <ErrorPage
        variant="404"
        title="مخاطب یافت نشد"
        description="شناسهٔ مخاطب معتبر نیست."
        actionHref={`${base}/contacts`}
        actionLabel="برگشت به مخاطبین"
        inline
      />
    );
  }

  if (error && !contact) {
    return (
      <div className="space-y-5">
        <PageBreadcrumb current="مخاطبین" />
        <ErrorPage
          variant="404"
          title="مخاطب یافت نشد"
          description={error}
          actionHref={`${base}/contacts`}
          actionLabel="برگشت به مخاطبین"
          inline
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1" aria-label="مسیر">
        <Link to={base} className="hover:text-foreground transition-colors">
          پنل
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <Link to={`${base}/contacts`} className="hover:text-foreground transition-colors">
          مخاطبین
        </Link>
        <ChevronLeft className="size-4 shrink-0" aria-hidden />
        <span className="text-foreground font-medium truncate max-w-[180px]">
          {loading ? '…' : contact?.fullName ?? 'مخاطب'}
        </span>
      </nav>

      {loading ? (
        <div className="glass-card rounded-card p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : contact ? (
        <>
          <div className="glass-card rounded-card p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/15 p-3 text-primary">
                  <User className="size-6" aria-hidden />
                </div>
                <div>
                  <h1 className="text-title-lg font-title">{contact.fullName}</h1>
                  <p className="text-sm text-muted-foreground">مخاطب</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`${base}/contacts`)}
                className="shrink-0"
              >
                برگشت به لیست
              </Button>
            </div>

            <dl className="mt-6 space-y-4">
              {contact.phone != null && contact.phone !== '' && (
                <div className="flex items-center gap-3">
                  <Phone className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">تلفن</dt>
                    <dd className="font-medium fa-num">{contact.phone}</dd>
                  </div>
                </div>
              )}
              {contact.email != null && contact.email !== '' && (
                <div className="flex items-center gap-3">
                  <Mail className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">ایمیل</dt>
                    <dd className="font-medium">{contact.email}</dd>
                  </div>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-3">
                  <Building2 className="size-5 text-muted-foreground shrink-0" aria-hidden />
                  <div>
                    <dt className="text-xs text-muted-foreground">شرکت</dt>
                    <dd>
                      <Link
                        to={`${base}/companies`}
                        className="font-medium text-primary hover:underline"
                      >
                        {contact.company.name}
                      </Link>
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>

          <Link
            to={`${base}/contacts`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-transparent px-4 py-2 font-medium transition-colors hover:bg-muted"
          >
            <ArrowRight className="size-4" aria-hidden />
            برگشت به مخاطبین
          </Link>
        </>
      ) : null}
    </div>
  );
}
