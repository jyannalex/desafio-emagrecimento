import type { Challenge, DailyLog, Food, MealItem, Photo, Profile, Tarefa, Weight } from '../types';
import { db } from '../lib/supabase';

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function getProfiles(): Promise<Profile[]> {
  return check(await db().from('profiles').select('id, nome, meta_agua_ml, cor').order('nome')) ?? [];
}

export async function updateProfile(id: string, p: Partial<Pick<Profile, 'nome' | 'meta_agua_ml' | 'cor'>>): Promise<void> {
  check(await db().from('profiles').update(p).eq('id', id));
}

export async function getChallenge(): Promise<Challenge | null> {
  return check(
    await db().from('challenge').select('id, nome, data_inicio, data_fim, premio').eq('id', 1).maybeSingle(),
  ) as Challenge | null;
}

export async function saveChallenge(c: Omit<Challenge, 'id'>): Promise<void> {
  check(await db().from('challenge').upsert({ id: 1, ...c }));
}

const LOG_COLS =
  'user_id, dia, cafe, almoco, lanche, jantar, nota_cafe, nota_almoco, nota_lanche, nota_jantar, nota_atividade, atividade, atividade_min, agua_ml, meta_agua_ml_do_dia';

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


// ───────── Fotos ─────────
// O arquivo fica no Storage (bucket privado "fotos", pasta = id da pessoa); a tabela photos guarda caminho e tamanho.

const BUCKET = 'fotos';
const PHOTO_COLS = 'id, user_id, dia, tarefa, path, bytes';
const LINK_VALIDADE_S = 6 * 3600;

function checkStorage(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

export async function getPhotos(from: string, to: string, userId?: string): Promise<Photo[]> {
  let q = db().from('photos').select(PHOTO_COLS).gte('dia', from).lte('dia', to);
  if (userId) q = q.eq('user_id', userId);
  return (check(await q) ?? []) as Photo[];
}

// links assinados reaproveitados enquanto valem: o navegador usa o cache e não baixa a foto de novo
const linkCache = new Map<string, { url: string; ate: number }>();

export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const agora = Date.now();
  const out: Record<string, string> = {};
  const faltam: string[] = [];
  for (const p of paths) {
    const c = linkCache.get(p);
    if (c && c.ate > agora + 5 * 60_000) out[p] = c.url;
    else faltam.push(p);
  }
  if (faltam.length) {
    const res = await db().storage.from(BUCKET).createSignedUrls(faltam, LINK_VALIDADE_S);
    checkStorage(res);
    for (const d of res.data ?? []) {
      if (d.path && d.signedUrl) {
        out[d.path] = d.signedUrl;
        linkCache.set(d.path, { url: d.signedUrl, ate: agora + LINK_VALIDADE_S * 1000 });
      }
    }
  }
  return out;
}

/** Envia (ou troca) a foto de uma tarefa do dia. A foto já deve vir reduzida (compressImage). */
export async function uploadPhoto(userId: string, dia: string, tarefa: Tarefa, foto: Blob): Promise<Photo> {
  const st = db().storage.from(BUCKET);
  const path = `${userId}/${dia}/${tarefa}-${Date.now()}.jpg`;
  checkStorage(await st.upload(path, foto, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
  let antiga: { path: string } | null = null;
  let nova: Photo;
  try {
    antiga = check(
      await db().from('photos').select('path').eq('user_id', userId).eq('dia', dia).eq('tarefa', tarefa).maybeSingle(),
    ) as { path: string } | null;
    nova = check(
      await db()
        .from('photos')
        .upsert({ user_id: userId, dia, tarefa, path, bytes: foto.size }, { onConflict: 'user_id,dia,tarefa' })
        .select(PHOTO_COLS)
        .single(),
    ) as Photo;
  } catch (e) {
    await st.remove([path]);
    throw e;
  }
  if (antiga && antiga.path !== path) await st.remove([antiga.path]); // se falhar, só sobra um arquivo solto
  return nova;
}

export async function deletePhoto(p: Pick<Photo, 'id' | 'path'>): Promise<void> {
  checkStorage(await db().storage.from(BUCKET).remove([p.path]));
  check(await db().from('photos').delete().eq('id', p.id));
  linkCache.delete(p.path);
}

export async function myPhotoStats(userId: string): Promise<{ count: number; bytes: number }> {
  const rows = (check(await db().from('photos').select('bytes').eq('user_id', userId)) ?? []) as { bytes: number }[];
  return { count: rows.length, bytes: rows.reduce((s, r) => s + r.bytes, 0) };
}

/** Apaga as fotos da pessoa até o dia (inclusive). Devolve quantas apagou. */
export async function deletePhotosUntil(userId: string, until: string): Promise<number> {
  const rows = (check(await db().from('photos').select('id, path').eq('user_id', userId).lte('dia', until)) ?? []) as {
    id: number;
    path: string;
  }[];
  for (let i = 0; i < rows.length; i += 100) {
    const lote = rows.slice(i, i + 100);
    checkStorage(await db().storage.from(BUCKET).remove(lote.map((r) => r.path)));
    check(await db().from('photos').delete().in('id', lote.map((r) => r.id)));
    lote.forEach((r) => linkCache.delete(r.path));
  }
  return rows.length;
}

// ---------- alimentos ----------

const FOOD_COLS = 'id, nome, kcal_100g, kcal_unidade, origem, criado_por';
const ITEM_COLS = 'id, user_id, dia, refeicao, food_id, nome, kcal_100g, gramas, unidades, kcal_unidade';
const PAGINA = 1000;

/** numeric do Postgres pode vir como texto: garante número. */
const n = (v: unknown) => (v == null ? null : Number(v));
const comoFood = (f: Food): Food => ({ ...f, kcal_100g: n(f.kcal_100g), kcal_unidade: n(f.kcal_unidade) });
const comoItem = (i: MealItem): MealItem => ({
  ...i,
  kcal_100g: n(i.kcal_100g),
  gramas: n(i.gramas),
  unidades: n(i.unidades),
  kcal_unidade: n(i.kcal_unidade),
});

/** Por grama: kcal_100g; por unidade: kcal_unidade. O outro vai null. */
export type MedidaFood = { kcal_100g: number | null; kcal_unidade: number | null };

let cacheFoods: Food[] | null = null;

export function limparCacheFoods() {
  cacheFoods = null;
}

/** Catálogo inteiro (TACO + cadastrados), baixado uma vez por sessão. */
export async function getFoods(): Promise<Food[]> {
  if (cacheFoods) return cacheFoods;
  const todos: Food[] = [];
  for (let de = 0; ; de += PAGINA) {
    const pagina = check(await db().from('foods').select(FOOD_COLS).order('id').range(de, de + PAGINA - 1)) ?? [];
    todos.push(...(pagina as Food[]).map(comoFood));
    if (pagina.length < PAGINA) break;
  }
  cacheFoods = todos;
  return todos;
}

export async function createFood(f: { nome: string; criado_por: string } & MedidaFood): Promise<Food> {
  const novo = comoFood(check(await db().from('foods').insert({ ...f, origem: 'custom' }).select(FOOD_COLS).single()) as Food);
  if (cacheFoods) cacheFoods = [...cacheFoods, novo];
  return novo;
}

export async function updateFood(id: number, f: { nome: string } & MedidaFood): Promise<Food> {
  const novo = comoFood(check(await db().from('foods').update(f).eq('id', id).select(FOOD_COLS).single()) as Food);
  if (cacheFoods) cacheFoods = cacheFoods.map((x) => (x.id === id ? novo : x));
  return novo;
}

export async function deleteFood(id: number): Promise<void> {
  check(await db().from('foods').delete().eq('id', id));
  if (cacheFoods) cacheFoods = cacheFoods.filter((x) => x.id !== id);
}

export async function getMealItems(from: string, to: string, userId?: string): Promise<MealItem[]> {
  let q = db().from('meal_items').select(ITEM_COLS).gte('dia', from).lte('dia', to).order('created_at').order('id');
  if (userId) q = q.eq('user_id', userId);
  return ((check(await q) ?? []) as MealItem[]).map(comoItem);
}

export async function addMealItem(i: Omit<MealItem, 'id'>): Promise<MealItem> {
  return comoItem(check(await db().from('meal_items').insert(i).select(ITEM_COLS).single()) as MealItem);
}

export async function updateMealItemQuantidade(id: number, q: { gramas: number } | { unidades: number }): Promise<MealItem> {
  return comoItem(check(await db().from('meal_items').update(q).eq('id', id).select(ITEM_COLS).single()) as MealItem);
}

export async function deleteMealItem(id: number): Promise<void> {
  check(await db().from('meal_items').delete().eq('id', id));
}

/** Alimentos que a pessoa usou por último (mais recente primeiro), sem repetir, até 8. */
export async function recentFoodIds(userId: string): Promise<number[]> {
  const rows = (check(
    await db()
      .from('meal_items')
      .select('food_id')
      .eq('user_id', userId)
      .not('food_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
  ) ?? []) as { food_id: number }[];
  return [...new Set(rows.map((r) => r.food_id))].slice(0, 8);
}
