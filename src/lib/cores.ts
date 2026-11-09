// Cor livre escolhida pela pessoa: ajusta o tom para ficar legível no tema claro e no escuro.

/** Fundo dos cartões em cada tema (mesmos valores de --surface em styles.css). */
export const SUPERFICIE_CLARA = '#ffffff';
export const SUPERFICIE_ESCURA = '#221a2e';

export const ehHex = (s: string) => /^#[0-9a-f]{6}$/.test(s);

type RGB = [number, number, number];

const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

function luminancia(h: string) {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Mistura `cor` com `fundo`; `peso` é quanto fica da cor (0–1). */
export function suave(cor: string, fundo: string, peso = 0.16) {
  const a = rgb(cor);
  const b = rgb(fundo);
  return hex(a.map((v, i) => v * peso + b[i] * (1 - peso)) as RGB);
}

function ajustar(cor: string, rumo: string, fundo: string, minimo: number) {
  for (let i = 0; i <= 20; i++) {
    const c = suave(rumo, cor, i * 0.05); // i*5% em direção a preto/branco
    if (contraste(c, fundo) >= minimo) return c;
  }
  return rumo;
}

/** Versão para o tema claro: escurece se precisar (contraste ≥ 3 com o cartão branco). */
export const paraClaro = (cor: string) => ajustar(cor, '#000000', SUPERFICIE_CLARA, 3);

/** Versão para o tema escuro: clareia se precisar (contraste ≥ 3,5 com o cartão escuro). */
export const paraEscuro = (cor: string) => ajustar(cor, '#ffffff', SUPERFICIE_ESCURA, 3.5);
