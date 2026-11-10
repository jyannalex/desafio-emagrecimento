import {
  addMealItem,
  createFood,
  deleteFood,
  deleteMealItem,
  getFoods,
  getMealItems,
  limparCacheFoods,
  recentFoodIds,
  updateFood,
  updateMealItemQuantidade,
} from './repo';

// Supabase falso: cada consulta encadeada registra as chamadas e devolve a próxima resposta da fila da tabela.
const log: string[] = [];
const filas: Record<string, { data: unknown; error: null | { message: string } }[]> = {};

function consulta(tabela: string) {
  const passos: string[] = [];
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lte', 'gte', 'in', 'insert', 'update', 'delete', 'single', 'order', 'range', 'not', 'limit']) {
    q[m] = (...args: unknown[]) => {
      passos.push(`${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
      return q;
    };
  }
  q.then = (ok: (v: unknown) => void) => {
    log.push(`${tabela}.${passos.join('.')}`);
    ok(filas[tabela]?.shift() ?? { data: null, error: null });
  };
  return q;
}

vi.mock('../lib/supabase', () => ({ db: () => ({ from: (t: string) => consulta(t) }) }));

const food = (id: number, nome = `A${id}`) => ({ id, nome, kcal_100g: 100, kcal_unidade: null, origem: 'taco', criado_por: null });

beforeEach(() => {
  log.length = 0;
  for (const k of Object.keys(filas)) delete filas[k];
  limparCacheFoods();
});

test('catálogo: busca em páginas de 1000 até acabar e guarda em memória', async () => {
  filas.foods = [
    { data: Array.from({ length: 1000 }, (_, i) => food(i + 1)), error: null },
    { data: [food(1001), food(1002), food(1003)], error: null },
  ];
  const a = await getFoods();
  expect(a).toHaveLength(1003);
  expect(log).toEqual([
    'foods.select("id, nome, kcal_100g, kcal_unidade, origem, criado_por").order("id").range(0,999)',
    'foods.select("id, nome, kcal_100g, kcal_unidade, origem, criado_por").order("id").range(1000,1999)',
  ]);
  const b = await getFoods();
  expect(b).toBe(a);
  expect(log).toHaveLength(2);
});

test('kcal vinda como texto vira número', async () => {
  filas.foods = [{ data: [{ ...food(1), kcal_100g: '128.0' }], error: null }];
  expect((await getFoods())[0].kcal_100g).toBe(128);
});

test('alimento e item por unidade: números viram número e o que falta fica null', async () => {
  filas.foods = [{ data: [{ ...food(1), kcal_100g: null, kcal_unidade: '250.0' }], error: null }];
  expect((await getFoods())[0]).toMatchObject({ kcal_100g: null, kcal_unidade: 250 });
  filas.meal_items = [
    { data: [{ id: 1, user_id: 'u1', dia: 'd', refeicao: 'lanche', food_id: 1, nome: 'Coxinha', kcal_100g: null, gramas: null, unidades: '2.0', kcal_unidade: '250.0' }], error: null },
    { data: { id: 1, unidades: '3.0', kcal_unidade: '250.0', gramas: null, kcal_100g: null }, error: null },
  ];
  expect((await getMealItems('d', 'd'))[0]).toMatchObject({ gramas: null, kcal_100g: null, unidades: 2, kcal_unidade: 250 });
  expect((await updateMealItemQuantidade(1, { unidades: 3 })).unidades).toBe(3);
  expect(log.at(-1)).toMatch(/^meal_items\.update\(\{"unidades":3\}\)\.eq\("id",1\)/);
});

test('cadastrar alimento grava como custom e entra no catálogo em memória', async () => {
  filas.foods = [
    { data: [food(1)], error: null },
    { data: { id: 50, nome: 'Marmita', kcal_100g: 400, origem: 'custom', criado_por: 'u1' }, error: null },
  ];
  await getFoods();
  const f = await createFood({ nome: 'Marmita', kcal_100g: 400, kcal_unidade: null, criado_por: 'u1' });
  expect(f.id).toBe(50);
  expect(log[1]).toBe('foods.insert({"nome":"Marmita","kcal_100g":400,"kcal_unidade":null,"criado_por":"u1","origem":"custom"}).select("id, nome, kcal_100g, kcal_unidade, origem, criado_por").single()');
  expect((await getFoods()).map((x) => x.id)).toEqual([1, 50]);
  expect(log).toHaveLength(2);
});

test('editar e apagar alimento atualizam o catálogo em memória', async () => {
  filas.foods = [
    { data: [food(1), { ...food(2), origem: 'custom', criado_por: 'u1' }], error: null },
    { data: { id: 2, nome: 'Novo', kcal_100g: 90, origem: 'custom', criado_por: 'u1' }, error: null },
  ];
  await getFoods();
  await updateFood(2, { nome: 'Novo', kcal_100g: 90, kcal_unidade: null });
  expect(log[1]).toBe('foods.update({"nome":"Novo","kcal_100g":90,"kcal_unidade":null}).eq("id",2).select("id, nome, kcal_100g, kcal_unidade, origem, criado_por").single()');
  expect((await getFoods()).find((x) => x.id === 2)?.nome).toBe('Novo');
  await deleteFood(2);
  expect(log[2]).toBe('foods.delete().eq("id",2)');
  expect((await getFoods()).map((x) => x.id)).toEqual([1]);
});

test('itens: lê por período (e pessoa), grava, muda gramas e apaga', async () => {
  const item = { id: 9, user_id: 'u1', dia: '2026-11-10', refeicao: 'almoco', food_id: 3, nome: 'Arroz', kcal_100g: '128.0', gramas: '120.0', unidades: null, kcal_unidade: null };
  filas.meal_items = [
    { data: [item], error: null },
    { data: item, error: null },
    { data: { ...item, gramas: '150.0' }, error: null },
  ];
  const lidos = await getMealItems('2026-11-01', '2026-11-10', 'u1');
  expect(lidos[0]).toMatchObject({ kcal_100g: 128, gramas: 120 });
  expect(log[0]).toBe(
    'meal_items.select("id, user_id, dia, refeicao, food_id, nome, kcal_100g, gramas, unidades, kcal_unidade").gte("dia","2026-11-01").lte("dia","2026-11-10").order("created_at").order("id").eq("user_id","u1")',
  );
  const { id: _, ...novo } = { ...lidos[0] };
  await addMealItem(novo);
  expect(log[1]).toMatch(/^meal_items\.insert\(\{.*"gramas":120.*\}\)\.select\(.*\)\.single\(\)$/);
  expect((await updateMealItemQuantidade(9, { gramas: 150 })).gramas).toBe(150);
  expect(log[2]).toBe('meal_items.update({"gramas":150}).eq("id",9).select("id, user_id, dia, refeicao, food_id, nome, kcal_100g, gramas, unidades, kcal_unidade").single()');
  await deleteMealItem(9);
  expect(log[3]).toBe('meal_items.delete().eq("id",9)');
});

test('recentes: últimos alimentos da pessoa sem repetir, até 8', async () => {
  const ids = [5, 3, 5, 7, 3, 1, 2, 4, 6, 8, 9, 10];
  filas.meal_items = [{ data: ids.map((food_id) => ({ food_id })), error: null }];
  expect(await recentFoodIds('u1')).toEqual([5, 3, 7, 1, 2, 4, 6, 8]);
  expect(log[0]).toBe(
    'meal_items.select("food_id").eq("user_id","u1").not("food_id","is",null).order("created_at",{"ascending":false}).limit(200)',
  );
});

test('erro do banco vira exceção', async () => {
  filas.meal_items = [{ data: null, error: { message: 'rls' } }];
  await expect(deleteMealItem(1)).rejects.toThrow('rls');
});
