import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { KPICard } from '../components/ui/glass';

type Kpis = {
  contactsCount: number;
  dealsCount: number;
  tasksDueToday: number;
  pipelineValue: string;
};

export default function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Kpis>('/dashboard')
      .then(setKpis)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cards = kpis
    ? [
        { title: 'مخاطبین', value: String(kpis.contactsCount) },
        { title: 'معاملات', value: String(kpis.dealsCount) },
        { title: 'ارزش پایپلاین', value: kpis.pipelineValue },
        { title: 'کارهای امروز', value: String(kpis.tasksDueToday) },
      ]
    : [
        { title: 'مخاطبین', value: '—' },
        { title: 'معاملات', value: '—' },
        { title: 'ارزش پایپلاین', value: '—' },
        { title: 'کارهای امروز', value: '—' },
      ];

  return (
    <div className="space-y-5">
      <h1 className="text-title-lg font-title">داشبورد</h1>
      {error && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {cards.map((card) => (
          <KPICard key={card.title} title={card.title} value={card.value} />
        ))}
      </div>
    </div>
  );
}
