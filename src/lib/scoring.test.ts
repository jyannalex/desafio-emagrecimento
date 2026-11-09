import type { DailyLog } from '../types';
import { dayPoints, standing, winner, MAX_POINTS } from './scoring';

const base = { cafe: false, almoco: false, lanche: false, jantar: false, atividade: false, agua_ml: 0, meta_agua_ml_do_dia: 2000 };
const log = (dia: string, p: Partial<DailyLog>) =>
  ({ ...base, user_id: 'a', dia, nota_cafe: null, nota_almoco: null, nota_lanche: null, nota_jantar: null, atividade_min: 0, ...p }) as DailyLog;
const ch = { id: 1 as const, nome: 'x', data_inicio: '2026-11-05', data_fim: '2026-11-20' };

test('MAX_POINTS é 6', () => expect(MAX_POINTS).toBe(6));

test('dayPoints', () => {
  expect(dayPoints(null)).toBe(0);
  expect(dayPoints(base)).toBe(0);
  expect(dayPoints({ ...base, cafe: true, almoco: true, lanche: true, jantar: true, atividade: true, agua_ml: 2000 })).toBe(6);
  expect(dayPoints({ ...base, agua_ml: 1999 })).toBe(0);
  expect(dayPoints({ ...base, atividade: true })).toBe(1);
});

test('meta de água usa a do dia', () => {
  expect(dayPoints({ ...base, agua_ml: 2500, meta_agua_ml_do_dia: 3000 })).toBe(0);
});

test('semana cruza o início do desafio', () => {
  // hoje = domingo 2026-11-08; semana 02..08, mas desafio começa 05
  const logs = [log('2026-11-04', { cafe: true }), log('2026-11-05', { cafe: true }), log('2026-11-08', { cafe: true, almoco: true })];
  const s = standing(logs, ch, '2026-11-08');
  expect(s.week).toEqual({ points: 3, days: 4, pct: 13 }); // 3/(6*4)=12.5 -> 13
  expect(s.total.points).toBe(3);
  expect(s.today.points).toBe(2);
  expect(s.status).toBe('andamento');
  expect(s.diasRestantes).toBe(12);
});

test('antes de começar: tudo zero, sem divisão por zero', () => {
  const s = standing([], ch, '2026-11-01');
  expect(s.total).toEqual({ points: 0, days: 0, pct: 0 });
  expect(s.week).toEqual({ points: 0, days: 0, pct: 0 });
  expect(s.today).toEqual({ points: 0, days: 0, pct: 0 });
  expect(s.status).toBe('antes');
  expect(s.diasRestantes).toBe(4); // 01 -> 05
});

test('encerrado: total limitado ao fim', () => {
  const s = standing([log('2026-11-20', { cafe: true }), log('2026-11-21', { cafe: true })], ch, '2026-11-25');
  expect(s.total.points).toBe(1);
  expect(s.total.days).toBe(16);
  expect(s.status).toBe('encerrado');
  expect(s.diasRestantes).toBe(0);
  expect(s.today).toEqual({ points: 0, days: 0, pct: 0 });
});

test('último dia ainda é andamento', () => {
  const s = standing([], ch, '2026-11-20');
  expect(s.status).toBe('andamento');
  expect(s.diasRestantes).toBe(0);
});

test('winner', () => {
  expect(winner({ id: 'a', total: 10 }, { id: 'b', total: 9 })).toBe('a');
  expect(winner({ id: 'a', total: 9 }, { id: 'b', total: 12 })).toBe('b');
  expect(winner({ id: 'a', total: 9 }, { id: 'b', total: 9 })).toBe('empate');
});
