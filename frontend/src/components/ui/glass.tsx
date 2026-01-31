/**
 * Aurora / Glass component recipes
 * کلاس‌های glass در aurora.css تعریف شده‌اند.
 */

import { forwardRef } from 'react';

export const glassCardClassName = 'glass-card';
export const glassPanelClassName = 'glass-panel';
export const glassTableSurfaceClassName = 'glass-table-surface';

/** کارت عمومی شیشه‌ای */
export const GlassCard = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function GlassCard({ className = '', ...props }, ref) {
  return <div ref={ref} className={`glass-card ${className}`.trim()} {...props} />;
});

/** کارت KPI — عنوان + عدد درشت (Peyda FaNum برای اعداد) */
export function KPICard({
  title,
  value,
  className = '',
}: {
  title: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`glass-card p-5 ${className}`.trim()}>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-kpi-lg font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

/** کلاس آیتم سایدبار: hover از --bg-muted (پالت Primer)؛ active از sidebar-active. */
export function sidebarItemClassName(active: boolean) {
  const base =
    'flex items-center h-11 gap-3 pe-3 ps-3 rounded-xl transition-colors ' +
    'hover:bg-[var(--bg-muted)] text-foreground';
  return active ? `${base} sidebar-active` : base;
}
