import type { Challenge, DailyLog, Profile, Weight } from '../types';
import { db } from '../lib/supabase';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function getProfiles(): Promise<Profile[]> {
  return check(await db().from('profiles').select('id, nome, meta_agua_ml').order('nome')) ?? [];
}

export async function updateProfile(id: string, p: Partial<Pick<Profile, 'nome' | 'meta_agua_ml'>>): Promise<void> {
  check(await db().from('profiles').update(p).eq('id', id));
}

export async function getChallenge(): Promise<Challenge | null> {
  return check(
    await db().from('challenge').select('id, nome, data_inicio, data_fim').eq('id', 1).maybeSingle(),
  ) as Challenge | null;
}

export async function saveChallenge(c: Omit<Challenge, 'id'>): Promise<void> {
  check(await db().from('challenge').upsert({ id: 1, ...c }));
}

const LOG_COLS =
  'user_id, dia, cafe, almoco, lanche, jantar, nota_cafe, nota_almoco, nota_lanche, nota_jantar, atividade, atividade_min, agua_ml, meta_agua_ml_do_dia';

export async function getLogs(from?: string, to?: string): Promise<DailyLog[]> {
  let q = db().from('daily_logs').select(LOG_COLS);
  if (from) q = q.gte('dia', from);
  if (to) q = q.lte('dia', to);
  return (check(await q.order('dia')) ?? []) as DailyLog[];
}

export async function upsertLog(log: DailyLog): Promise<DailyLog> {
  return check(
    await db().from('daily_logs').upsert(log, { onConflict: 'user_id,dia' }).select(LOG_COLS).single(),
  ) as DailyLog;
}

export async function getWeights(): Promise<Weight[]> {
  const rows = (check(await db().from('weights').select('id, user_id, dia, kg').order('dia')) ?? []) as Weight[];
  return rows.map((w) => ({ ...w, kg: Number(w.kg) }));
}

export async function upsertWeight(w: Omit<Weight, 'id'>): Promise<void> {
  check(await db().from('weights').upsert(w, { onConflict: 'user_id,dia' }));
}

export async function deleteWeight(id: number): Promise<void> {
  check(await db().from('weights').delete().eq('id', id));
}
