import { contraste, ehHex, paraClaro, paraEscuro, suave, SUPERFICIE_CLARA, SUPERFICIE_ESCURA } from './cores';

test('reconhece #rrggbb', () => {
  expect(ehHex('#3a7bd5')).toBe(true);
  expect(ehHex('#3A7BD5')).toBe(false); // gravamos sempre minúsculo
  expect(ehHex('menta')).toBe(false);
  expect(ehHex('#123')).toBe(false);
});

test('contraste: preto × branco é 21', () => {
  expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 0);
});

test('tema claro: cor clara demais escurece até dar para ler', () => {
  const amarelo = paraClaro('#ffee00');
  expect(contraste(amarelo, SUPERFICIE_CLARA)).toBeGreaterThanOrEqual(3);
  expect(amarelo).not.toBe('#ffee00');
});

test('tema escuro: cor escura demais clareia até dar para ler', () => {
  const marinho = paraEscuro('#001144');
  expect(contraste(marinho, SUPERFICIE_ESCURA)).toBeGreaterThanOrEqual(3.5);
});

test('cor que já dá para ler fica igual', () => {
  expect(paraClaro('#4c5bd9')).toBe('#4c5bd9');
  expect(paraEscuro('#ff8a4c')).toBe('#ff8a4c');
});

test('versão suave mistura a cor com o fundo', () => {
  expect(suave('#ff0000', '#ffffff', 0.2)).toBe('#ffcccc');
});
