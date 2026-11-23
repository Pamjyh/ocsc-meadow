export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  targetThaiDate: string;
}

const THAI_DATE_FORMATTER = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Formats an ISO timestamp into Thai Buddhist Era date locked to Asia/Bangkok (F3). */
export function formatThaiBuddhistDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'ยังไม่กำหนดวันสอบ';
  return THAI_DATE_FORMATTER.format(new Date(ms));
}

export function computeCountdown(
  targetIso: string,
  nowMs = Date.now(),
): CountdownParts {
  const targetMs = Date.parse(targetIso);
  const targetThaiDate = formatThaiBuddhistDate(targetIso);

  if (Number.isNaN(targetMs) || targetMs <= nowMs) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isPast: !Number.isNaN(targetMs),
      targetThaiDate,
    };
  }

  const totalSeconds = Math.floor((targetMs - nowMs) / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isPast: false,
    targetThaiDate,
  };
}
