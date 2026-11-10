import type { Food } from '../types';
import { buscarAlimentos, formatKcal, kcalItem, kcalPor100, lerGramas, normalizar, somaKcal } from './calorias';

const f = (id: number, nome: string, kcal_100g = 100): Food => ({ id, nome, kcal_100g, origem: 'taco', criado_por: null });

const CATALOGO = [
  f(1, 'Arroz branco cozido', 128),
  f(2, 'Feijão carioca cozido', 76),
  f(3, 'Peito de frango grelhado', 159),
  f(4, 'Frango cru', 129),
  f(5, 'Frango, coxa, com pele, assada', 215),
  f(6, 'Pão francês', 300),
  f(7, 'Torrada de pão francês', 377),
];

test('kcal do item arredonda', () => {
  expect(kcalItem(120, 128)).toBe(154);
  expect(kcalItem(140, 76)).toBe(106);
});

test('soma das kcal usa cada item já arredondado', () => {
  expect(
    somaKcal([
      { gramas: 120, kcal_100g: 128 },
      { gramas: 140, kcal_100g: 76 },
    ]),
  ).toBe(260);
  expect(somaKcal([])).toBe(0);
});

test('normaliza acento, maiúscula e espaços', () => {
  expect(normalizar('  Feijão   CARIOCA ')).toBe('feijao carioca');
});

test('busca por palavras em qualquer ordem, sem acento', () => {
  const r = buscarAlimentos(CATALOGO, 'grelhado frango', []);
  expect(r.map((x) => x.id)).toEqual([3]);
  expect(buscarAlimentos(CATALOGO, 'FEIJAO', []).map((x) => x.id)).toEqual([2]);
});

test('termo vazio devolve os recentes na ordem dada', () => {
  expect(buscarAlimentos(CATALOGO, '  ', [6, 1, 99]).map((x) => x.id)).toEqual([6, 1]);
});

test('ordem: recentes, depois começa com a palavra, depois nome mais curto', () => {
  const r = buscarAlimentos(CATALOGO, 'frango', [5]).map((x) => x.id);
  expect(r).toEqual([5, 4, 3]);
  // "pao": 6 começa com "pão", 7 não
  expect(buscarAlimentos(CATALOGO, 'pao', []).map((x) => x.id)).toEqual([6, 7]);
});

test('no máximo 30 resultados', () => {
  const muitos = Array.from({ length: 50 }, (_, i) => f(100 + i, `Banana ${i}`));
  expect(buscarAlimentos(muitos, 'banana', [])).toHaveLength(30);
});

test('formata kcal em pt-BR', () => {
  expect(formatKcal(1430)).toBe('1.430 kcal');
  expect(formatKcal(0)).toBe('0 kcal');
});

test('lê gramas digitadas', () => {
  expect(lerGramas('120')).toBe(120);
  expect(lerGramas('120,5')).toBe(120.5);
  expect(lerGramas(' 80 ')).toBe(80);
  expect(lerGramas('')).toBeNull();
  expect(lerGramas('0')).toBeNull();
  expect(lerGramas('5001')).toBeNull();
  expect(lerGramas('abc')).toBeNull();
  expect(lerGramas('12a')).toBeNull();
});

test('converte kcal da embalagem para 100 g', () => {
  expect(kcalPor100(120, 30)).toBe(400);
  expect(kcalPor100(100, 100)).toBe(100);
  expect(kcalPor100(50, 30)).toBe(166.7);
});
