export type SmsStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';

export type SmsLogItem = {
  id: string;
  senderLine: string;
  recipientPhone: string;
  recipientName: string | null;
  body: string;
  status: SmsStatus;
  source: string;
  campaignKey: string | null;
  errorMessage: string | null;
  queuedAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  createdBy: {
    userId: string;
    name: string;
  };
  template: {
    id: string;
    name: string;
  } | null;
};

export type SmsListResponse = {
  scope: 'me' | 'team';
  senderLine: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRatePct: number;
    failureRatePct: number;
  };
  items: SmsLogItem[];
};

export type SmsTemplateItem = {
  id: string;
  name: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SmsTemplatesResponse = {
  senderLine: string;
  items: SmsTemplateItem[];
};

export type SmsOptOutItem = {
  id: string;
  phone: string;
  reason: string | null;
  createdAt: string;
};

export type SmsOptOutListResponse = {
  items: SmsOptOutItem[];
};

export type SendSingleSmsResponse = {
  senderLine: string;
  item: SmsLogItem;
};

export type SendBulkSmsResponse = {
  senderLine: string;
  campaignKey: string;
  requested: number;
  created: number;
  skippedInvalid: number;
  skippedOptOut: number;
};
