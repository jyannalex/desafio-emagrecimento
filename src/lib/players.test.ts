import { CORES, playerColors, playerSlot, playerSoftVar, playerVar } from './players';

const ps = [
  { id: 'b-2', nome: 'Ana', meta_agua_ml: 2000 },
  { id: 'a-1', nome: 'Zé', meta_agua_ml: 2000 },
];

test('ordem segue o id, não o nome', () => {
  expect(playerSlot(ps, 'a-1')).toBe(1);
  expect(playerSlot(ps, 'b-2')).toBe(2);
});

test('id desconhecido fica em 1º', () => {
  expect(playerSlot(ps, 'x')).toBe(1);
});

test('paleta tem 6 cores com nome', () => {
  expect(CORES.map((c) => c.id)).toEqual(['tangerina', 'mirtilo', 'framboesa', 'menta', 'uva', 'turquesa']);
  expect(CORES.every((c) => c.nome.length > 0)).toBe(true);
});

test('sem escolha: tangerina para o 1º e mirtilo para o 2º', () => {
  const m = playerColors(ps);
  expect(m.get('a-1')).toBe('tangerina');
  expect(m.get('b-2')).toBe('mirtilo');
});

test('cor escolhida vale', () => {
  const m = playerColors([{ ...ps[0], cor: 'menta' }, { ...ps[1], cor: 'uva' }]);
  expect(m.get('b-2')).toBe('menta');
  expect(m.get('a-1')).toBe('uva');
});

test('quem não escolheu nunca fica com a cor do outro', () => {
  // o 2º escolheu tangerina, que seria o padrão do 1º
  const m = playerColors([{ ...ps[0], cor: 'tangerina' }, ps[1]]);
  expect(m.get('b-2')).toBe('tangerina');
  expect(m.get('a-1')).toBe('mirtilo');
});

test('se os dois escolheram a mesma, o 2º volta para a cor padrão dele', () => {
  const m = playerColors([{ ...ps[0], cor: 'uva' }, { ...ps[1], cor: 'uva' }]);
  expect(m.get('a-1')).toBe('uva');
  expect(m.get('b-2')).toBe('mirtilo');
});

test('variáveis CSS da cor', () => {
  expect(playerVar('menta')).toBe('var(--c-menta)');
  expect(playerSoftVar('menta')).toBe('var(--c-menta-soft)');
});
