import type { Food } from '../types';
import { buscarAlimentos, formatKcal, kcalDoItem, kcalItem, kcalPor100, kcalTexto, lerGramas, lerNumero, lerUnidades, normalizar, qtdTexto, somaKcal } from './calorias';

const f = (id: number, nome: string, kcal_100g = 100): Food => ({ id, nome, kcal_100g, kcal_unidade: null, origem: 'taco', criado_por: null });

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
      { gramas: 120, kcal_100g: 128, unidades: null, kcal_unidade: null },
      { gramas: 140, kcal_100g: 76, unidades: null, kcal_unidade: null },
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

test('gramas: no máximo 1 casa decimal (como o banco guarda)', () => {
  expect(lerGramas('120,55')).toBeNull();
  expect(lerGramas('0,04')).toBeNull();
  expect(lerGramas('0,1')).toBe(0.1);
  expect(lerGramas('120.5')).toBe(120.5);
});

test('gramas: ponto de milhar', () => {
  expect(lerGramas('1.000')).toBe(1000);
  expect(lerGramas('1.500,5')).toBe(1500.5);
  expect(lerGramas('10.000')).toBeNull(); // passa de 5.000
});

test('kcal digitada: aceita 0, vírgula e ponto de milhar', () => {
  expect(lerNumero('0')).toBe(0);
  expect(lerNumero('12,5')).toBe(12.5);
  expect(lerNumero('1.000')).toBe(1000);
  expect(lerNumero('12,55')).toBeNull();
  expect(lerNumero('')).toBeNull();
  expect(lerNumero('abc')).toBeNull();
});

// ---------- por unidade ----------

const g = (gramas: number, kcal_100g: number) => ({ gramas, kcal_100g, unidades: null, kcal_unidade: null });
const un = (unidades: number, kcal_unidade: number) => ({ gramas: null, kcal_100g: null, unidades, kcal_unidade });

test('kcal do item por grama ou por unidade', () => {
  expect(kcalDoItem(g(120, 128))).toBe(154);
  expect(kcalDoItem(un(2, 250))).toBe(500);
  expect(kcalDoItem(un(0.5, 125))).toBe(63);
  expect(somaKcal([g(120, 128), un(2, 250)])).toBe(654);
});

test('texto da quantidade e das calorias do alimento', () => {
  expect(qtdTexto(g(120.5, 128))).toBe('120,5 g');
  expect(qtdTexto(un(2, 250))).toBe('2 un');
  expect(qtdTexto(un(0.5, 250))).toBe('0,5 un');
  expect(kcalTexto({ kcal_100g: 128, kcal_unidade: null })).toBe('128 kcal/100 g');
  expect(kcalTexto({ kcal_100g: null, kcal_unidade: 250 })).toBe('250 kcal/un');
});

test('unidades digitadas: até 100, 1 casa decimal', () => {
  expect(lerUnidades('2')).toBe(2);
  expect(lerUnidades('0,5')).toBe(0.5);
  expect(lerUnidades('0')).toBeNull();
  expect(lerUnidades('101')).toBeNull();
  expect(lerUnidades('1,25')).toBeNull();
});
