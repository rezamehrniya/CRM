import { apiGet } from '@/lib/api';
import { CallsLiveResponse, CallsLogsResponse, CallLogItem } from './types';

type CallsScope = 'me' | 'team';

type CallsLogQuery = {
  scope?: CallsScope;
  from?: string;
  to?: string;
  status?: string;
  hasRecording?: boolean;
  page?: number;
  pageSize?: number;
  agentUserId?: string;
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

export async function getCallsLive(scope: CallsScope = 'me') {
  return apiGet<CallsLiveResponse>(withQuery('/calls/live', { scope }));
}

export async function getCallsLogs(query?: CallsLogQuery) {
  return apiGet<CallsLogsResponse>(
    withQuery('/calls', {
      scope: query?.scope,
      from: query?.from,
      to: query?.to,
      status: query?.status,
      hasRecording:
        query?.hasRecording === undefined
          ? undefined
          : query.hasRecording
            ? 'true'
            : 'false',
      page: query?.page ? String(query.page) : undefined,
      pageSize: query?.pageSize ? String(query.pageSize) : undefined,
      agentUserId: query?.agentUserId,
    }),
  );
}

export async function getCallById(id: string) {
  return apiGet<CallLogItem>(`/calls/${id}`);
}

