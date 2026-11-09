import { playerSlot } from './players';

const ps = [
  { id: 'b-2', nome: 'Ana', meta_agua_ml: 2000 },
  { id: 'a-1', nome: 'Zé', meta_agua_ml: 2000 },
];

test('cor segue a ordem do id, não do nome', () => {
  expect(playerSlot(ps, 'a-1')).toBe(1);
  expect(playerSlot(ps, 'b-2')).toBe(2);
});

test('id desconhecido usa a cor 1', () => {
  expect(playerSlot(ps, 'x')).toBe(1);
});
