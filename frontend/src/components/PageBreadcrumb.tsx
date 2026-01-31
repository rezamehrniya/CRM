/**
 * Breadcrumb برای صفحات پنل: پنل ← عنوان صفحه.
 */
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

type PageBreadcrumbProps = {
  /** عنوان صفحهٔ فعلی (مثلاً «مخاطبین»، «معاملات») */
  current: string;
};

export function PageBreadcrumb({ current }: PageBreadcrumbProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-1" aria-label="مسیر">
      <Link to={base} className="hover:text-foreground transition-colors">
        پنل
      </Link>
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      <span className="text-foreground font-medium">{current}</span>
    </nav>
  );
}
