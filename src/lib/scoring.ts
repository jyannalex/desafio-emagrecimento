import type { Challenge, DailyLog } from '../types';
import { addDays, daysInclusive, weekStart } from './dates';

/** Café, almoço, jantar, atividade e água. O lanche é registrado mas não vale ponto. */
export const MAX_POINTS = 5;
/** Minutos de atividade no dia para ganhar o ponto. */
export const ATIVIDADE_META_MIN = 60;

type PointFields = Pick<DailyLog, 'cafe' | 'almoco' | 'jantar' | 'atividade_min' | 'agua_ml' | 'meta_agua_ml_do_dia'> &
  Partial<Pick<DailyLog, 'atividade' | 'lanche'>>;

export function dayPoints(log: PointFields | null | undefined): number {
  if (!log) return 0;
  const checks = [
    log.cafe,
    log.almoco,
    log.jantar,
    log.atividade_min >= ATIVIDADE_META_MIN,
    log.agua_ml >= log.meta_agua_ml_do_dia,
  ];
  return checks.filter(Boolean).length;
}

export type Score = { points: number; days: number; pct: number };

const ZERO: Score = { points: 0, days: 0, pct: 0 };

export function scoreRange(logs: DailyLog[], from: string, to: string): Score {
  const days = daysInclusive(from, to);
  if (days === 0) return { ...ZERO };
  const points = logs.filter((l) => l.dia >= from && l.dia <= to).reduce((s, l) => s + dayPoints(l), 0);
  return { points, days, pct: Math.round((points / (MAX_POINTS * days)) * 100) };
}

export type Standing = {
  total: Score;
  week: Score;
  today: Score;
  status: 'antes' | 'andamento' | 'encerrado';
  diasRestantes: number;
};

/** Placar de UMA pessoa (quem chama filtra os logs por user_id). */
export function standing(logs: DailyLog[], ch: Challenge, today: string): Standing {
  const end = today < ch.data_fim ? today : ch.data_fim;
  const wStart = weekStart(today) > ch.data_inicio ? weekStart(today) : ch.data_inicio;
  const status = today < ch.data_inicio ? 'antes' : today > ch.data_fim ? 'encerrado' : 'andamento';
  const diasRestantes =
    status === 'antes'
      ? daysInclusive(today, ch.data_inicio) - 1
      : status === 'andamento'
        ? daysInclusive(addDays(today, 1), ch.data_fim)
        : 0;
  return {
    total: scoreRange(logs, ch.data_inicio, end),
    week: scoreRange(logs, wStart, end),
    today: status === 'andamento' ? scoreRange(logs, today, today) : { ...ZERO },
    status,
    diasRestantes,
  };
}

export function winner(a: { id: string; total: number }, b: { id: string; total: number }): string | 'empate' {
  if (a.total === b.total) return 'empate';
  return a.total > b.total ? a.id : b.id;
}
