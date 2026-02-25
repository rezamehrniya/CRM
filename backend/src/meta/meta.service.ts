import { Injectable } from '@nestjs/common';

type ServerTimePayload = {
  serverNowIso: string;
  timezone: string;
  jalali: {
    pretty: string;
    date: string;
    weekday: string;
  };
};

@Injectable()
export class MetaService {
  private readonly timezone = 'Asia/Tehran';

  private formatJalali(now: Date) {
    const locale = 'fa-IR-u-ca-persian';
    const date = new Intl.DateTimeFormat(locale, {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const weekday = new Intl.DateTimeFormat(locale, {
      timeZone: this.timezone,
      weekday: 'long',
    }).format(now);

    const pretty = new Intl.DateTimeFormat(locale, {
      timeZone: this.timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);

    return { pretty, date, weekday };
  }

  getServerTime(): ServerTimePayload {
    const now = new Date();
    return {
      serverNowIso: now.toISOString(),
      timezone: this.timezone,
      jalali: this.formatJalali(now),
    };
  }
}

