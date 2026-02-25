import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import {
  SendBulkSmsResponse,
  SendSingleSmsResponse,
  SmsListResponse,
  SmsOptOutItem,
  SmsOptOutListResponse,
  SmsStatus,
  SmsTemplateItem,
  SmsTemplatesResponse,
} from './types';

type SmsScope = 'me' | 'team';

type SmsListQuery = {
  scope?: SmsScope;
  from?: string;
  to?: string;
  status?: SmsStatus;
  page?: number;
  pageSize?: number;
  createdByUserId?: string;
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

export async function getSmsLogs(query?: SmsListQuery) {
  return apiGet<SmsListResponse>(
    withQuery('/sms', {
      scope: query?.scope,
      from: query?.from,
      to: query?.to,
      status: query?.status,
      page: query?.page ? String(query.page) : undefined,
      pageSize: query?.pageSize ? String(query.pageSize) : undefined,
      createdByUserId: query?.createdByUserId,
    }),
  );
}

export async function sendSingleSms(payload: {
  recipientPhone: string;
  recipientName?: string;
  body?: string;
  templateId?: string;
}) {
  return apiPost<SendSingleSmsResponse>('/sms/send', payload);
}

export async function sendBulkSms(payload: {
  recipients: Array<{ phone: string; name?: string }>;
  body?: string;
  templateId?: string;
  campaignName?: string;
}) {
  return apiPost<SendBulkSmsResponse>('/sms/bulk', payload);
}

export async function getSmsTemplates() {
  return apiGet<SmsTemplatesResponse>('/sms/templates');
}

export async function createSmsTemplate(payload: {
  name: string;
  body: string;
  isActive?: boolean;
}) {
  return apiPost<SmsTemplateItem>('/sms/templates', payload);
}

export async function updateSmsTemplate(
  id: string,
  payload: { name?: string; body?: string; isActive?: boolean },
) {
  return apiPatch<SmsTemplateItem>(`/sms/templates/${id}`, payload);
}

export async function deleteSmsTemplate(id: string) {
  return apiDelete<{ ok: boolean }>(`/sms/templates/${id}`);
}

export async function getSmsOptOuts() {
  return apiGet<SmsOptOutListResponse>('/sms/opt-outs');
}

export async function addSmsOptOut(payload: { phone: string; reason?: string }) {
  return apiPost<SmsOptOutItem>('/sms/opt-outs', payload);
}

export async function removeSmsOptOut(phone: string) {
  return apiDelete<{ ok: boolean }>(`/sms/opt-outs/${encodeURIComponent(phone)}`);
}
