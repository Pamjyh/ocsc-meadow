const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Returns exact decimal hour [0, 24) in Asia/Bangkok (+07:00) independent of device TZ. */
export function getBangkokHourFloat(nowMs = Date.now()): number {
  const bkk = new Date(nowMs + BANGKOK_OFFSET_MS);
  return (
    bkk.getUTCHours() +
    bkk.getUTCMinutes() / 60 +
    bkk.getUTCSeconds() / 3600
  );
}

/** Switches Apple Liquid Glass to Dark Glass during twilight & night (18:36 - 05:36). */
export function isDarkAtmosphere(hourFloat: number): boolean {
  const h = ((hourFloat % 24) + 24) % 24;
  return h >= 18.6 || h < 5.6;
}
