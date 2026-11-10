// Gera supabase/migrations/0006_taco.sql a partir de data/taco/*.csv e data/taco/nomes-curtos.json.
// Uso: node scripts/taco-seed.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Leites que vêm sem kcal na fonte: valor típico de embalagem (kcal/100 g). */
const LEITES = [
  { taco_id: 9001, nome: 'Leite integral', kcal_100g: 60 },
  { taco_id: 9002, nome: 'Leite desnatado', kcal_100g: 35 },
];

/** CSV simples (aspas duplas delimitam campos com vírgula). Ignora a linha de cabeçalho. */
export function parseCsv(texto) {
  return texto
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((linha) => {
      const campos = [];
      let atual = '';
      let aspas = false;
      for (const ch of linha) {
        if (ch === '"') aspas = !aspas;
        else if (ch === ',' && !aspas) {
          campos.push(atual);
          atual = '';
        } else atual += ch;
      }
      campos.push(atual);
      return campos;
    });
}

export function montarAlimentos(foodCsv, nutrientsCsv, nomesCurtos) {
  const kcal = new Map(parseCsv(nutrientsCsv).map((r) => [r[0], r[2]]));
  const lista = [];
  for (const [id, , nome] of parseCsv(foodCsv)) {
    const k = kcal.get(id);
    if (k === undefined || k.trim() === '' || Number.isNaN(Number(k))) continue;
    lista.push({ taco_id: Number(id), nome: (nomesCurtos[id] ?? nome).trim().replace(/\s+/g, ' '), kcal_100g: Number(k) });
  }
  return [...lista, ...LEITES];
}

const q = (s) => `'${s.replace(/'/g, "''")}'`;

export function gerarSql(alimentos) {
  const valores = alimentos.map((a) => `  (${a.taco_id}, ${q(a.nome)}, ${a.kcal_100g})`).join(',\n');
  return `-- Gerado por scripts/taco-seed.mjs a partir da TACO 4ª ed. (NEPA/UNICAMP), via raulfdm/taco-api (MIT).
-- Não editar à mão: mude data/taco/* e rode o script de novo.
insert into public.foods (taco_id, nome, kcal_100g, origem)
select v.taco_id, v.nome, v.kcal_100g, 'taco' from (values
${valores}
) as v(taco_id, nome, kcal_100g)
on conflict (taco_id) do nothing;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const ler = (p) => readFileSync(resolve(raiz, p), 'utf8');
  const alimentos = montarAlimentos(ler('data/taco/food.csv'), ler('data/taco/nutrients.csv'), JSON.parse(ler('data/taco/nomes-curtos.json')));
  writeFileSync(resolve(raiz, 'supabase/migrations/0006_taco.sql'), gerarSql(alimentos));
  console.log(`0006_taco.sql: ${alimentos.length} alimentos`);
}
