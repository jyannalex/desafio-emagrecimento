import type { Challenge } from '../types';

const fmtBR = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data de hoje (YYYY-MM-DD) no fuso America/Sao_Paulo. */
export function todayBR(now: Date = new Date()): string {
  return fmtBR.format(now);
}

function toUTC(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

export function addDays(day: string, n: number): string {
  return fromUTC(toUTC(day) + n * DAY_MS);
}

/** Segunda-feira da semana de `day`. */
export function weekStart(day: string): string {
  const dow = new Date(toUTC(day)).getUTCDay(); // 0 = domingo
  return addDays(day, -((dow + 6) % 7));
}

/** Quantidade de dias de `from` a `to`, inclusivo; 0 se `to < from`. */
export function daysInclusive(from: string, to: string): number {
  if (to < from) return 0;
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS) + 1;
}

export function isEditable(
  day: string,
  today: string,
  ch: Pick<Challenge, 'data_inicio' | 'data_fim'>,
): boolean {
  const recent = day === today || day === addDays(today, -1);
  return recent && day >= ch.data_inicio && day <= ch.data_fim;
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function formatBR(day: string): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}
