import { fitSize, FOTO_LADO_MAX } from './imagem';

test('lado maior vira 1280, mantendo a proporção', () => {
  expect(FOTO_LADO_MAX).toBe(1280);
  expect(fitSize(4000, 3000)).toEqual({ w: 1280, h: 960 });
  expect(fitSize(3024, 4032)).toEqual({ w: 960, h: 1280 });
});

test('foto pequena não aumenta', () => {
  expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
});
