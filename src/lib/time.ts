// Reminder times as "HH:MM" strings.

export const MINUTE_STEP = 5;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * "07:32" → [7, 30]: round to the nearest MINUTE_STEP, carrying into the next
 * hour (and past midnight) when needed, e.g. "23:58" → [0, 0].
 */
export function splitTime(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  const total = (h || 0) * 60 + (m || 0);
  const rounded = (Math.round(total / MINUTE_STEP) * MINUTE_STEP) % (24 * 60);
  return [Math.floor(rounded / 60), rounded % 60];
}

export function joinTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}
