// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error módulo .mjs sem tipos
import { gerarSql, montarAlimentos, parseCsv } from './taco-seed.mjs';

const ler = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

const FOOD = `id,categoryId,name
1,1,"Arroz, tipo 1, cozido"
2,1,"Pão d'água"
3,1,"Leite, de vaca, integral"
`;
const NUTR = `foodId,moisture,kcal,kJ
1,70,128,535
2,30,250,1000
3,88,,
`;

test('lê CSV com aspas e vírgulas dentro do campo', () => {
  expect(parseCsv(FOOD)[0]).toEqual(['1', '1', 'Arroz, tipo 1, cozido']);
});

test('tira quem não tem kcal, aplica nome curto e acrescenta os leites', () => {
  const a = montarAlimentos(FOOD, NUTR, { '1': 'Arroz branco cozido' });
  expect(a).toEqual([
    { taco_id: 1, nome: 'Arroz branco cozido', kcal_100g: 128 },
    { taco_id: 2, nome: "Pão d'água", kcal_100g: 250 },
    { taco_id: 9001, nome: 'Leite integral', kcal_100g: 60 },
    { taco_id: 9002, nome: 'Leite desnatado', kcal_100g: 35 },
  ]);
});

test('SQL escapa aspas e não duplica ao rodar de novo', () => {
  const sql = gerarSql(montarAlimentos(FOOD, NUTR, {}));
  expect(sql).toContain("(2, 'Pão d''água', 250)");
  expect(sql).toContain("(9001, 'Leite integral', 60)");
  expect(sql).toContain("(9002, 'Leite desnatado', 35)");
  expect(sql).toContain('on conflict (taco_id) do nothing');
});

test('com os arquivos reais: 591 da TACO + 2 leites, sem id repetido, nomes curtos válidos', () => {
  const curtos = JSON.parse(ler('data/taco/nomes-curtos.json')) as Record<string, string>;
  const a = montarAlimentos(ler('data/taco/food.csv'), ler('data/taco/nutrients.csv'), curtos);
  expect(a).toHaveLength(593);
  expect(new Set(a.map((x: { taco_id: number }) => x.taco_id)).size).toBe(593);
  const nomes = new Set(a.map((x: { nome: string }) => x.nome));
  for (const n of Object.values(curtos)) expect(nomes).toContain(n);
  expect(a.find((x: { taco_id: number }) => x.taco_id === 3)).toEqual({ taco_id: 3, nome: 'Arroz branco cozido', kcal_100g: 128 });
});
