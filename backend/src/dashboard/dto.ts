export type RevenueMode = 'PROXY_QUOTE_SIGNED' | 'REAL_SALES_INVOICE';

export type SparkPoint = { x: string; y: number };

export type ManagerOverviewResponse = {
  hero: {
    revenue: {
      mode: RevenueMode;
      current: number;
      previous: number;
      deltaPct: number;
      sparkline: SparkPoint[];
    };
    pipeline: {
      openQuotesValue: number;
      openQuotesCount: number;
      quoteToInvoiceRatePct: number;
    };
    funnel: { totalConversionPct: number; bottleneckStage: string };
    teamTarget: { target: number; achieved: number; progressPct: number };
  };
  kpis: {
    leadsToday: number;
    overdueFollowUps: number;
    avgResponseHours: number | null;
    quotesPendingApproval: number;
    signedContractsThisMonth: number;
    avgRevenueUnitValue: number | null;
    avgRevenueUnitLabel: 'avgSalesInvoice' | 'avgSignedQuote' | null;
  };
  funnelStages: {
    stageKey: string;
    stageLabel: string;
    count: number;
    budgetSum: number;
    conversionFromPrevPct: number;
    avgDaysInStage: number;
  }[];
  revenueTrend: { bucket: string; actual: number; target: number }[];
  quoteStatus: {
    status: 'DRAFT' | 'SENT' | 'APPROVED' | 'CONVERTED' | 'CANCELED';
    count: number;
    value: number;
  }[];
  actionCenter: {
    topOpportunities: { id: string; company: string; amount: number; stage: string; owner: string }[];
    overdueLeads: { id: string; name: string; overdueDays: number; owner: string }[];
    contractsThisWeek: { id: string; company: string; signedAt: string; amount: number }[];
  };
  quoteContract: {
    thisMonth: {
      count: number;
      amountSum: number;
      avgAmount: number;
      avgDaysFromQuoteSent: number | null;
    };
    latestSigned: {
      id: string;
      company: string;
      signedAt: string;
      amount: number;
      owner: string;
    }[];
  };
  smsToday: {
    sentToday: number;
    deliveredToday: number;
    failedToday: number;
    deliveryRatePct: number;
    reps: {
      userId: string;
      name: string;
      sentToday: number;
      deliveredToday: number;
      failedToday: number;
    }[];
  };
};

export type ManagerTeamResponse = {
  rows: {
    userId: string;
    name: string;
    revenue: number;
    quotesValue: number;
    conversionRatePct: number;
    overdueCount: number;
    personalTarget: number | null;
    progressPct: number;
  }[];
};

export type RepDashboardResponse = {
  today: { tasksToday: number; overdue: number; callsToday: number; pendingQuotes: number };
  smsToday: { sentToday: number; deliveredToday: number; failedToday: number; deliveryRatePct: number };
  myFunnel: { stageKey: string; stageLabel: string; count: number }[];
  myTarget: { target: number; achieved: number; remaining: number; pace: 'AHEAD' | 'ON_TRACK' | 'BEHIND' };
  reminders: {
    urgentFollowUps: { type: 'LEAD' | 'TASK'; id: string; title: string; dueAt: string; overdueDays: number }[];
    waitingResponse: { id: string; title: string; sinceDays: number }[];
  };
};
