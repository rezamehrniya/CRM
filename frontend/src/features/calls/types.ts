export type CallDirection = 'INBOUND' | 'OUTBOUND';
export type CallStatus = 'RINGING' | 'IN_PROGRESS' | 'ANSWERED' | 'MISSED' | 'FAILED' | 'ENDED';
export type AgentCallState = 'AVAILABLE' | 'RINGING' | 'ON_CALL' | 'AFTER_CALL_WORK' | 'OFFLINE';

export type CallsLiveAgent = {
  userId: string;
  name: string;
  ext: string;
  state: AgentCallState;
  currentCall: {
    callId: string;
    direction: CallDirection;
    durationSec: number;
  } | null;
  hasRecording: boolean;
  lastStatus: CallStatus | null;
};

export type CallsLiveResponse = {
  scope: 'me' | 'team';
  serverNowIso: string;
  agents: CallsLiveAgent[];
};

export type CallLogItem = {
  id: string;
  direction: CallDirection;
  fromNumber: string;
  toNumber: string;
  status: CallStatus;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number | null;
  ext: string;
  recordingUrl: string | null;
  providerCallId: string;
  agent: {
    userId: string;
    name: string;
  };
  answeredBy: {
    userId: string;
    name: string;
  } | null;
};

export type CallsLogsResponse = {
  scope: 'me' | 'team';
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: {
    total: number;
    answered: number;
    missed: number;
    failed: number;
    inProgress: number;
    withRecording: number;
    totalDurationSec: number;
    avgDurationSec: number;
  };
  items: CallLogItem[];
};

