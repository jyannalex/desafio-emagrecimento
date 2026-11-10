import type { Challenge, DailyLog, Ponto, VarLance } from '../types';
import { addDays, daysInclusive, weekStart } from './dates';

/** Café, almoço, jantar, atividade e água. O lanche é registrado mas não vale ponto. */
export const MAX_POINTS = 5;
/** Minutos de atividade no dia para ganhar o ponto. */
export const ATIVIDADE_META_MIN = 60;

type PointFields = Pick<DailyLog, 'cafe' | 'almoco' | 'jantar' | 'atividade_min' | 'agua_ml' | 'meta_agua_ml_do_dia'> &
  Partial<Pick<DailyLog, 'atividade' | 'lanche'>>;

/** Pontos do dia; `anulados` são os que o VAR tirou (lances aceitos). */
export function dayPoints(log: PointFields | null | undefined, anulados: Ponto[] = []): number {
  if (!log) return 0;
  const feitos: Record<Ponto, boolean> = {
    cafe: log.cafe,
    almoco: log.almoco,
    jantar: log.jantar,
    atividade: log.atividade_min >= ATIVIDADE_META_MIN,
    agua: log.agua_ml >= log.meta_agua_ml_do_dia,
  };
  return (Object.keys(feitos) as Ponto[]).filter((p) => feitos[p] && !anulados.includes(p)).length;
}

/** Pontos anulados pelo VAR (lances aceitos) de uma pessoa, por dia. */
export function anuladosPorDia(lances: VarLance[], userId: string): Map<string, Ponto[]> {
  const m = new Map<string, Ponto[]>();
  for (const l of lances) {
    if (l.status !== 'aceito' || l.alvo !== userId) continue;
    m.set(l.dia, [...(m.get(l.dia) ?? []), l.ponto]);
  }
  return m;
}

export type Score = { points: number; days: number; pct: number };

const ZERO: Score = { points: 0, days: 0, pct: 0 };

export function scoreRange(logs: DailyLog[], from: string, to: string, anulados?: Map<string, Ponto[]>): Score {
  const days = daysInclusive(from, to);
  if (days === 0) return { ...ZERO };
  const points = logs.filter((l) => l.dia >= from && l.dia <= to).reduce((s, l) => s + dayPoints(l, anulados?.get(l.dia)), 0);
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
export function standing(logs: DailyLog[], ch: Challenge, today: string, anulados?: Map<string, Ponto[]>): Standing {
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
    total: scoreRange(logs, ch.data_inicio, end, anulados),
    week: scoreRange(logs, wStart, end, anulados),
    today: status === 'andamento' ? scoreRange(logs, today, today, anulados) : { ...ZERO },
    status,
    diasRestantes,
  };
}

export function winner(a: { id: string; total: number }, b: { id: string; total: number }): string | 'empate' {
  if (a.total === b.total) return 'empate';
  return a.total > b.total ? a.id : b.id;
}
