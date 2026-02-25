import { apiGet } from '@/lib/api';
import {
  ManagerOverviewResponse,
  ManagerTeamResponse,
  RepDashboardResponse,
  TeamSortBy,
} from './types';

type DateRange = {
  from?: string;
  to?: string;
};

function withQuery(path: string, query?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (!value) return;
    search.set(key, value);
  });
  const queryString = search.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export async function getManagerOverview(range?: DateRange) {
  return apiGet<ManagerOverviewResponse>(withQuery('/dashboard/manager/overview', range));
}

export async function getManagerTeam(range?: DateRange & { sortBy?: TeamSortBy }) {
  return apiGet<ManagerTeamResponse>(withQuery('/dashboard/manager/team', range));
}

export async function getRepDashboard(range?: DateRange) {
  return apiGet<RepDashboardResponse>(withQuery('/dashboard/rep', range));
}

