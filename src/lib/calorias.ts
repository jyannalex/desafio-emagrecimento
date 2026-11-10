import type { Food, MealItem } from '../types';

export const GRAMAS_MAX = 5000;
export const KCAL_100G_MAX = 900;
const MAX_RESULTADOS = 30;

export const kcalItem = (gramas: number, kcal100: number) => Math.round((gramas * kcal100) / 100);

export const somaKcal = (itens: Pick<MealItem, 'gramas' | 'kcal_100g'>[]) =>
  itens.reduce((t, i) => t + kcalItem(i.gramas, i.kcal_100g), 0);

/** Minúsculo, sem acento e com um espaço só entre as palavras. */
export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Busca local no catálogo: todas as palavras do termo precisam aparecer no nome (em qualquer ordem).
 * Ordem: recentes, depois quem começa com a 1ª palavra, depois nome mais curto. Sem termo, só os recentes.
 */
export function buscarAlimentos(catalogo: Food[], termo: string, recentes: number[]): Food[] {
  const palavras = normalizar(termo).split(' ').filter(Boolean);
  if (palavras.length === 0) {
    const porId = new Map(catalogo.map((f) => [f.id, f]));
    return recentes.map((id) => porId.get(id)).filter((f): f is Food => !!f);
  }
  const posRecente = new Map(recentes.map((id, i) => [id, i]));
  const achados = catalogo
    .map((f) => ({ f, n: normalizar(f.nome) }))
    .filter(({ n }) => palavras.every((p) => n.includes(p)));
  const chave = ({ f, n }: { f: Food; n: string }) =>
    [posRecente.get(f.id) ?? Infinity, n.startsWith(palavras[0]) ? 0 : 1, n.length] as const;
  achados.sort((a, b) => {
    const [x, y] = [chave(a), chave(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.n.localeCompare(b.n);
  });
  return achados.slice(0, MAX_RESULTADOS).map(({ f }) => f);
}

export const formatKcal = (n: number) => `${n.toLocaleString('pt-BR')} kcal`;

/**
 * Número digitado do jeito brasileiro, com no máximo 1 casa decimal (o banco guarda numeric(6,1)).
 * "12,5" e "12.5" → 12,5; "1.000" e "1.500,5" → ponto de milhar. null se não der para ler.
 */
export function lerNumero(s: string): number | null {
  let t = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d)?$/.test(t)) t = t.replace(/\./g, '');
  t = t.replace(',', '.');
  return /^\d+(\.\d)?$/.test(t) ? Number(t) : null;
}

/** Gramas digitadas ("120", "120,5", "1.000"); null se inválido, ≤ 0 ou acima do limite. */
export function lerGramas(s: string): number | null {
  const g = lerNumero(s);
  return g !== null && g > 0 && g <= GRAMAS_MAX ? g : null;
}

/** "120 kcal em 30 g" (embalagem) → kcal em 100 g, com 1 casa decimal. */
export const kcalPor100 = (kcal: number, gramas: number) => Math.round((kcal * 1000) / gramas) / 10;
