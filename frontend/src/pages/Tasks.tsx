import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { JalaliDate } from '@/components/ui/jalali-date';
import { JalaliDateInput } from '@/components/ui/jalali-date-input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/auth-context';
import { formatFaNum } from '@/lib/numbers';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

const BOARD_COLUMNS = [
  { code: 'backlog', label: 'بک‌لاگ' },
  { code: 'today', label: 'امروز' },
  { code: 'in_progress', label: 'در حال انجام' },
  { code: 'waiting', label: 'منتظر پاسخ' },
  { code: 'done', label: 'انجام شد' },
] as const;

const TABS = [
  { code: 'board', label: 'Sales Board' },
  { code: 'my-tasks', label: 'کارهای من' },
  { code: 'team', label: 'تیم' },
  { code: 'archive', label: 'آرشیو' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'کم' },
  { value: 'MEDIUM', label: 'متوسط' },
  { value: 'HIGH', label: 'بالا' },
  { value: 'URGENT', label: 'فوری' },
] as const;

type TabCode = (typeof TABS)[number]['code'];
type TaskStatus = (typeof BOARD_COLUMNS)[number]['code'];

type UserLite = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  position: number;
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  assignedToUserId?: string | null;
  assignee?: UserLite | null;
  createdBy?: UserLite | null;
  contact?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  company?: { id: string; name: string } | null;
  deal?: { id: string; title: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse = {
  data: Task[];
  total: number;
  page: number;
  pageSize: number;
  tab: TabCode;
};

type OptionLite = { id: string; name: string };

type TaskForm = {
  title: string;
  description: string;
  dueAt: string;
  status: TaskStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedToUserId: string;
  contactId: string;
  companyId: string;
  dealId: string;
};

function toTab(value: string | null): TabCode {
  if (!value) return 'board';
  const normalized = value.trim().toLowerCase();
  return (TABS.some((x) => x.code === normalized) ? normalized : 'board') as TabCode;
}

function toStatus(value: string): TaskStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'open') return 'today';
  if (normalized === 'done') return 'done';
  return (BOARD_COLUMNS.some((x) => x.code === normalized) ? normalized : 'backlog') as TaskStatus;
}

function personName(user?: UserLite | null): string {
  if (!user) return 'بدون مسئول';
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return user.displayName?.trim() || fullName || user.email || user.phone || 'بدون مسئول';
}

function priorityStripeClass(priority: Task['priority']) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-500';
    case 'HIGH':
      return 'bg-orange-500';
    case 'LOW':
      return 'bg-slate-400';
    default:
      return 'bg-blue-500';
  }
}

function priorityPillClass(priority: Task['priority']) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'LOW':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
}

function referenceSurfaceClass(task: Task) {
  if (task.dealId) return 'bg-blue-50/80 border-blue-200/80';
  if (task.contactId) return 'bg-purple-50/80 border-purple-200/80';
  if (task.companyId) return 'bg-amber-50/80 border-amber-200/80';
  return 'bg-slate-50/90 border-slate-200/80';
}

function dueTone(task: Task) {
  if (!task.dueAt) return { label: 'بدون موعد', className: 'bg-slate-100 text-slate-600' };
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return { label: 'بدون موعد', className: 'bg-slate-100 text-slate-600' };
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  const isDone = toStatus(task.status) === 'done';
  if (!isDone && due.getTime() < start) return { label: 'سررسید گذشته', className: 'bg-red-100 text-red-700' };
  if (!isDone && due.getTime() >= start && due.getTime() < end) return { label: 'موعد امروز', className: 'bg-yellow-100 text-yellow-800' };
  return { label: 'موعد', className: 'bg-slate-100 text-slate-700' };
}

function avatarChar(user?: UserLite | null) {
  const name = personName(user);
  return name.charAt(0) || '?';
}

const COLUMN_THEME: Record<TaskStatus, { wrap: string; header: string; ring: string }> = {
  backlog: { wrap: 'bg-slate-50 border-slate-200', header: 'bg-slate-100/80', ring: 'ring-slate-300' },
  today: { wrap: 'bg-sky-50 border-sky-200', header: 'bg-sky-100/80', ring: 'ring-sky-300' },
  in_progress: { wrap: 'bg-amber-50 border-amber-200', header: 'bg-amber-100/80', ring: 'ring-amber-300' },
  waiting: { wrap: 'bg-purple-50 border-purple-200', header: 'bg-purple-100/80', ring: 'ring-purple-300' },
  done: { wrap: 'bg-emerald-50 border-emerald-200', header: 'bg-emerald-100/80', ring: 'ring-emerald-300' },
};

function statusBadgeClass(status: string) {
  const normalized = toStatus(status);
  if (normalized === 'today') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (normalized === 'done') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (normalized === 'in_progress') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (normalized === 'waiting') return 'bg-purple-100 text-purple-700 border-purple-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function priorityDotClass(priority: Task['priority']) {
  if (priority === 'URGENT') return 'bg-red-500';
  if (priority === 'HIGH') return 'bg-orange-500';
  if (priority === 'LOW') return 'bg-emerald-500';
  return 'bg-blue-500';
}

function rowAccentClass(priority: Task['priority']) {
  if (priority === 'URGENT') return 'border-r-red-500';
  if (priority === 'HIGH') return 'border-r-orange-500';
  if (priority === 'LOW') return 'border-r-emerald-500';
  return 'border-r-blue-500';
}

function groupTasks(tasks: Task[]) {
  const grouped: Record<TaskStatus, Task[]> = {
    backlog: [],
    today: [],
    in_progress: [],
    waiting: [],
    done: [],
  };

  for (const task of tasks) {
    grouped[toStatus(task.status)].push(task);
  }

  for (const key of Object.keys(grouped) as TaskStatus[]) {
    grouped[key].sort((a, b) => a.position - b.position || (a.updatedAt || '').localeCompare(b.updatedAt || ''));
  }

  return grouped;
}

function defaultForm(userId?: string): TaskForm {
  return {
    title: '',
    description: '',
    dueAt: '',
    status: 'today',
    priority: 'MEDIUM',
    assignedToUserId: userId || '',
    contactId: '',
    companyId: '',
    dealId: '',
  };
}

function SortableCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.82 : 1,
  };

  const dueChip = dueTone(task);
  const assigneeName = personName(task.assignee);
  const creatorName = personName(task.createdBy);
  const showCreator = !!task.createdBy && task.createdBy.id !== task.assignee?.id;
  const contactName = `${task.contact?.firstName ?? ''} ${task.contact?.lastName ?? ''}`.trim();

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`group relative cursor-grab overflow-hidden rounded-xl border p-3 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md active:cursor-grabbing ${referenceSurfaceClass(task)} ${
        isDragging ? 'rotate-[0.6deg] shadow-xl' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className={`absolute right-0 top-0 h-full w-1.5 ${priorityStripeClass(task.priority)}`} />
      <div className="space-y-3 pe-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-6 text-slate-900">{task.title}</h4>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition hover:bg-white/80 hover:text-slate-900"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            title="ویرایش"
            aria-label="ویرایش"
          >
            <Pencil className="size-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priorityPillClass(task.priority)}`}>
            {PRIORITY_OPTIONS.find((x) => x.value === task.priority)?.label ?? task.priority}
          </span>
          {task.deal?.title && <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">{task.deal.title}</span>}
          {task.company?.name && (
            <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">{task.company.name}</span>
          )}
          {contactName && (
            <span className="rounded-full border border-purple-200 bg-purple-100 px-2 py-0.5 text-[11px] text-purple-700">{contactName}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium ${dueChip.className}`}>
            {task.dueAt ? <JalaliDate value={task.dueAt} dateOnly /> : dueChip.label}
          </span>

          <div className="flex items-center gap-2">
            <div className="flex items-center -space-x-2 rtl:space-x-reverse">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-900 text-[10px] font-semibold text-white">
                {avatarChar(task.assignee)}
              </span>
              {showCreator && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-500 text-[10px] font-semibold text-white">
                  {avatarChar(task.createdBy)}
                </span>
              )}
            </div>
            <div className="text-[11px] leading-4 text-slate-600">
              <div>{assigneeName}</div>
              {showCreator && <div className="text-slate-500">ایجاد: {creatorName}</div>}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function DroppableColumn({
  id,
  label,
  tasks,
  onEdit,
}: {
  id: TaskStatus;
  label: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const tone = COLUMN_THEME[id];

  return (
    <section className={`w-[330px] min-w-[330px] shrink-0 rounded-2xl border ${tone.wrap}`}>
      <header className={`sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-white/60 px-3 py-2 ${tone.header}`}>
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="fa-num rounded-full border border-white/80 bg-white/90 px-2 py-0.5 text-xs text-slate-700 shadow-sm">
          {formatFaNum(tasks.length)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={`min-h-[220px] space-y-2 rounded-b-2xl p-3 transition ${isOver ? `ring-2 ${tone.ring} bg-white/60` : ''}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} onEdit={onEdit} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/50 py-8 text-center text-xs text-slate-500">
            کارت جدید را اینجا رها کنید
          </div>
        )}
      </div>
    </section>
  );
}

export default function Tasks() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/t/${tenantSlug}/app`;
  const { hasPermission, user } = useAuth();
  const canManageTasks = hasPermission('tasks.manage');

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = toTab(searchParams.get('tab'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TaskForm>(defaultForm(user?.id));

  const [assignees, setAssignees] = useState<UserLite[]>([]);
  const [contacts, setContacts] = useState<OptionLite[]>([]);
  const [companies, setCompanies] = useState<OptionLite[]>([]);
  const [deals, setDeals] = useState<OptionLite[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (!searchParams.get('tab')) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', 'board');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ tab, page: String(page), pageSize: tab === 'board' ? '500' : '25' });
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter.trim()) params.set('status', statusFilter.trim());

    try {
      const res = await apiGet<ListResponse>(`/tasks?${params.toString()}`);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت کارها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, [tab, page, q, statusFilter]);

  useEffect(() => {
    if (!formOpen) return;
    const loadOptions = async () => {
      try {
        const [assigneesRes, contactsRes, companiesRes, dealsRes] = await Promise.all([
          apiGet<UserLite[]>('/tasks/assignees'),
          apiGet<{ data: Array<{ id: string; firstName?: string | null; lastName?: string | null }>; total: number }>(
            '/contacts?page=1&pageSize=100',
          ),
          apiGet<{ data: Array<{ id: string; name: string }>; total: number }>('/companies?page=1&pageSize=100'),
          apiGet<{ data: Array<{ id: string; title: string }>; total: number }>('/quotes?page=1&pageSize=100'),
        ]);

        setAssignees(assigneesRes);
        setContacts(
          contactsRes.data.map((c) => ({
            id: c.id,
            name: `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.id,
          })),
        );
        setCompanies(companiesRes.data.map((c) => ({ id: c.id, name: c.name })));
        setDeals(dealsRes.data.map((d) => ({ id: d.id, name: d.title })));
      } catch {
        // non-blocking for modal open
      }
    };

    void loadOptions();
  }, [formOpen]);

  useEffect(() => {
    setForm(defaultForm(user?.id));
  }, [user?.id]);

  const grouped = useMemo(() => groupTasks(data?.data ?? []), [data?.data]);
  const activeTask = useMemo(
    () => (activeTaskId ? (data?.data ?? []).find((task) => task.id === activeTaskId) ?? null : null),
    [activeTaskId, data?.data],
  );
  const kpis = useMemo(() => {
    const tasks = data?.data ?? [];
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayStartTs = dayStart.getTime();
    const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;

    const todayCount = tasks.filter((t) => {
      if (!t.dueAt) return false;
      const ts = new Date(t.dueAt).getTime();
      return ts >= dayStartTs && ts < dayEndTs;
    }).length;
    const urgentCount = tasks.filter((t) => t.priority === 'URGENT' && toStatus(t.status) !== 'done').length;
    const overdueCount = tasks.filter((t) => {
      if (!t.dueAt || toStatus(t.status) === 'done') return false;
      return new Date(t.dueAt).getTime() < dayStartTs;
    }).length;

    const doneWithCycle = tasks.filter((t) => toStatus(t.status) === 'done' && t.createdAt && t.updatedAt);
    const avgCycleDays = doneWithCycle.length
      ? doneWithCycle.reduce((sum, t) => {
          const start = new Date(t.createdAt as string).getTime();
          const end = new Date(t.updatedAt as string).getTime();
          return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
        }, 0) / doneWithCycle.length
      : 0;

    return { todayCount, urgentCount, overdueCount, avgCycleDays: Number(avgCycleDays.toFixed(1)) };
  }, [data?.data]);

  const teamGroups = useMemo(() => {
    const tasks = data?.data ?? [];
    const map = new Map<string, { assignee: UserLite | null; tasks: Task[] }>();
    for (const task of tasks) {
      const key = task.assignee?.id ?? task.assignedToUserId ?? 'unassigned';
      const current = map.get(key) ?? { assignee: task.assignee ?? null, tasks: [] };
      current.tasks.push(task);
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [data?.data]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm(user?.id));
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description || '',
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : '',
      status: toStatus(task.status),
      priority: task.priority || 'MEDIUM',
      assignedToUserId: task.assignedToUserId || user?.id || '',
      contactId: task.contactId || '',
      companyId: task.companyId || '',
      dealId: task.dealId || '',
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(defaultForm(user?.id));
  };

  const saveTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueAt: form.dueAt || undefined,
      status: form.status,
      priority: form.priority,
      assignedToUserId: form.assignedToUserId || undefined,
      contactId: form.contactId || undefined,
      companyId: form.companyId || undefined,
      dealId: form.dealId || undefined,
    };

    try {
      if (editing) {
        await apiPatch(`/tasks/${editing.id}`, payload);
      } else {
        await apiPost('/tasks', payload);
      }
      closeForm();
      await fetchTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره کار');
    } finally {
      setSaving(false);
    }
  };

  const removeTask = async (id: string) => {
    if (!confirm('حذف این کار؟')) return;
    setSaving(true);
    try {
      await apiDelete(`/tasks/${id}`);
      closeForm();
      await fetchTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'خطا در حذف');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over || !data) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const sourceColumn = (Object.keys(grouped) as TaskStatus[]).find((column) => grouped[column].some((task) => task.id === activeId));
    if (!sourceColumn) return;

    let targetColumn: TaskStatus | undefined;
    let targetIndex = 0;

    if (BOARD_COLUMNS.some((col) => col.code === overId)) {
      targetColumn = overId as TaskStatus;
      targetIndex = grouped[targetColumn].length;
    } else {
      const holder = (Object.keys(grouped) as TaskStatus[]).find((column) => grouped[column].some((task) => task.id === overId));
      if (!holder) return;
      targetColumn = holder;
      targetIndex = grouped[holder].findIndex((task) => task.id === overId);
      if (targetIndex < 0) targetIndex = grouped[holder].length;
    }

    const sourceIndex = grouped[sourceColumn].findIndex((task) => task.id === activeId);
    if (sourceColumn === targetColumn && sourceIndex === targetIndex) return;

    try {
      await apiPatch(`/tasks/${activeId}/move`, { status: targetColumn, order: targetIndex });
      await fetchTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'جابجایی کارت انجام نشد');
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const visibleTabs = canManageTasks ? TABS : TABS.filter((t) => t.code !== 'team');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title-lg font-title">کارها</h1>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="size-4" />
          تسک جدید
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((item) => {
            const active = tab === item.code;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setPage(1);
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', item.code);
                  setSearchParams(next);
                }}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'bg-[var(--bg-muted)] text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجو در عنوان، توضیحات، مشتری..."
          className="w-80 bg-card"
        />
        {tab !== 'board' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-card px-3 text-sm"
          >
            <option value="">همه وضعیت‌ها</option>
            {BOARD_COLUMNS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm">
          امروز: <span className="fa-num font-semibold">{formatFaNum(kpis.todayCount)}</span>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 shadow-sm">
          اورژنت: <span className="fa-num font-semibold">{formatFaNum(kpis.urgentCount)}</span>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs text-orange-700 shadow-sm">
          Overdue: <span className="fa-num font-semibold">{formatFaNum(kpis.overdueCount)}</span>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 shadow-sm">
          میانگین تکمیل: <span className="fa-num font-semibold">{formatFaNum(kpis.avgCycleDays)} روز</span>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : tab === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragCancel={() => setActiveTaskId(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-2">
            {BOARD_COLUMNS.map((column) => (
              <DroppableColumn
                key={column.code}
                id={column.code}
                label={column.label}
                tasks={grouped[column.code]}
                onEdit={openEdit}
              />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? (
              <article
                className={`relative w-[320px] rotate-1 overflow-hidden rounded-xl border p-3 shadow-2xl ${referenceSurfaceClass(activeTask)}`}
              >
                <div className={`absolute right-0 top-0 h-full w-1.5 ${priorityStripeClass(activeTask.priority)}`} />
                <div className="space-y-2 pe-2">
                  <h4 className="text-sm font-semibold text-slate-900">{activeTask.title}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${priorityPillClass(activeTask.priority)}`}>
                      {PRIORITY_OPTIONS.find((x) => x.value === activeTask.priority)?.label ?? activeTask.priority}
                    </span>
                    {activeTask.deal?.title && (
                      <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700">
                        {activeTask.deal.title}
                      </span>
                    )}
                    {activeTask.company?.name && (
                      <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                        {activeTask.company.name}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <>
          {tab === 'my-tasks' && (
            <div className="glass-table-surface overflow-x-auto rounded-card">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="h-11 border-b border-[var(--border-default)] bg-[var(--bg-toolbar)]">
                    <th className="text-start pe-4 ps-4 font-medium">عنوان</th>
                    <th className="text-start pe-4 ps-4 font-medium">وضعیت</th>
                    <th className="text-start pe-4 ps-4 font-medium">موعد</th>
                    <th className="text-start pe-4 ps-4 font-medium">اولویت</th>
                    <th className="text-start pe-4 ps-4 w-24">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data ?? []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        موردی یافت نشد
                      </td>
                    </tr>
                  )}
                  {(data?.data ?? []).map((task, idx) => (
                    <tr
                      key={task.id}
                      className={`h-12 border-b border-[var(--border-default)] border-r-4 transition ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      } hover:bg-indigo-50 ${rowAccentClass(task.priority)}`}
                    >
                      <td className="pe-4 ps-4">
                        <Link to={`${base}/tasks/${task.id}`} className="font-medium text-primary hover:underline">
                          {task.title}
                        </Link>
                      </td>
                      <td className="pe-4 ps-4">
                        <span className={`rounded-full border px-2 py-1 text-xs ${statusBadgeClass(task.status)}`}>
                          {BOARD_COLUMNS.find((c) => c.code === toStatus(task.status))?.label || 'نامشخص'}
                        </span>
                      </td>
                      <td className="pe-4 ps-4 font-mono text-xs text-slate-600">
                        {task.dueAt ? <JalaliDate value={task.dueAt} dateOnly /> : '—'}
                      </td>
                      <td className="pe-4 ps-4">
                        <span className="inline-flex items-center gap-2 text-xs text-slate-700">
                          <span className={`h-2.5 w-2.5 rounded-full ${priorityDotClass(task.priority)}`} />
                          {PRIORITY_OPTIONS.find((x) => x.value === task.priority)?.label ?? task.priority}
                        </span>
                      </td>
                      <td className="pe-4 ps-4">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`${base}/tasks/${task.id}`}
                            className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                            aria-label="مشاهده"
                            title="مشاهده"
                          >
                            <Eye className="size-4" />
                          </Link>
                          <button
                            type="button"
                            className="rounded-md p-2 text-muted-foreground hover:bg-[var(--bg-muted)] hover:text-foreground"
                            onClick={() => openEdit(task)}
                            aria-label="ویرایش"
                            title="ویرایش"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'team' && (
            <div className="space-y-3">
              {teamGroups.length === 0 && (
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-center text-sm text-muted-foreground">
                  موردی برای تیم یافت نشد
                </div>
              )}
              {teamGroups.map((group) => {
                const capacity = 12;
                const load = group.tasks.length;
                const loadPercent = Math.min(100, Math.round((load / capacity) * 100));
                const loadClass = load >= 10 ? 'bg-red-500' : load >= 6 ? 'bg-orange-500' : 'bg-emerald-500';
                return (
                  <section key={group.assignee?.id ?? 'unassigned'} className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                    <header className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                          {avatarChar(group.assignee)}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{personName(group.assignee)}</p>
                          <p className="fa-num text-xs text-slate-500">{formatFaNum(load)} تسک</p>
                        </div>
                      </div>
                      <div className="min-w-[160px]">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                          <span>Workload</span>
                          <span className="fa-num">
                            {formatFaNum(load)} / {formatFaNum(capacity)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-200">
                          <div className={`h-2 rounded-full ${loadClass}`} style={{ width: `${loadPercent}%` }} />
                        </div>
                      </div>
                    </header>
                    <div className="space-y-2">
                      {group.tasks.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 border-r-4 ${rowAccentClass(task.priority)}`}
                        >
                          <div className="min-w-0">
                            <Link to={`${base}/tasks/${task.id}`} className="block truncate text-sm font-medium text-primary hover:underline">
                              {task.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className={`rounded-full border px-2 py-0.5 ${statusBadgeClass(task.status)}`}>
                                {BOARD_COLUMNS.find((c) => c.code === toStatus(task.status))?.label || 'نامشخص'}
                              </span>
                              {task.deal?.title && (
                                <span className="rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-blue-700">{task.deal.title}</span>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-[11px] font-mono text-slate-600">
                            {task.dueAt ? <JalaliDate value={task.dueAt} dateOnly /> : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {tab === 'archive' && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 opacity-80 [filter:saturate(0.8)]">
              <div className="space-y-2">
                {(data?.data ?? []).length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 py-8 text-center text-sm text-slate-500">
                    موردی در آرشیو وجود ندارد
                  </div>
                )}
                {(data?.data ?? []).map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white/80 p-2.5">
                    <div className="min-w-0">
                      <Link to={`${base}/tasks/${task.id}`} className="block truncate text-sm font-medium text-slate-800 hover:underline">
                        {task.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600">
                        <span className={`rounded-full border px-2 py-0.5 ${statusBadgeClass(task.status)}`}>
                          {BOARD_COLUMNS.find((c) => c.code === toStatus(task.status))?.label || 'نامشخص'}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5">
                          تاریخ انجام: {task.updatedAt ? <JalaliDate value={task.updatedAt} dateOnly /> : '—'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                      onClick={() => openEdit(task)}
                      aria-label="ویرایش"
                      title="ویرایش"
                    >
                      <Pencil className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!data && data.total > data.pageSize && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground fa-num">
                {formatFaNum(data.data.length)} از {formatFaNum(data.total)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  قبلی
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * data.pageSize >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
          onClick={closeForm}
          onKeyDown={(e) => e.key === 'Escape' && closeForm()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-form-title"
        >
          <div className="glass-card w-full max-w-2xl rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 id="task-form-title" className="mb-4 text-lg font-semibold">
              {editing ? 'ویرایش تسک' : 'تسک جدید'}
            </h2>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="task-title">عنوان</Label>
                <Input
                  id="task-title"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="عنوان تسک"
                  className="bg-card"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="task-description">توضیحات</Label>
                <textarea
                  id="task-description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="توضیح کوتاه"
                  rows={3}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-status">وضعیت</Label>
                <select
                  id="task-status"
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3"
                >
                  {BOARD_COLUMNS.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-priority">اولویت</Label>
                <select
                  id="task-priority"
                  value={form.priority}
                  onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as Task['priority'] }))}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-assignee">مسئول</Label>
                <select
                  id="task-assignee"
                  value={form.assignedToUserId}
                  onChange={(e) => setForm((prev) => ({ ...prev, assignedToUserId: e.target.value }))}
                  disabled={!canManageTasks}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3 disabled:opacity-60"
                >
                  {(assignees.length > 0 ? assignees : user ? [user as UserLite] : []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {personName(member)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-due">تاریخ سررسید</Label>
                <JalaliDateInput
                  id="task-due"
                  value={form.dueAt}
                  onChange={(value) => setForm((prev) => ({ ...prev, dueAt: value }))}
                  className="bg-card"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-contact">مخاطب</Label>
                <select
                  id="task-contact"
                  value={form.contactId}
                  onChange={(e) => setForm((prev) => ({ ...prev, contactId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3"
                >
                  <option value="">انتخاب نشده</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-company">شرکت</Label>
                <select
                  id="task-company"
                  value={form.companyId}
                  onChange={(e) => setForm((prev) => ({ ...prev, companyId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3"
                >
                  <option value="">انتخاب نشده</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-deal">معامله</Label>
                <select
                  id="task-deal"
                  value={form.dealId}
                  onChange={(e) => setForm((prev) => ({ ...prev, dealId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-input bg-card px-3"
                >
                  <option value="">انتخاب نشده</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {editing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeTask(editing.id)}
                  disabled={saving}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              )}
              <Button type="button" variant="outline" onClick={closeForm}>
                انصراف
              </Button>
              <Button type="button" onClick={() => void saveTask()} disabled={saving || !form.title.trim()}>
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

