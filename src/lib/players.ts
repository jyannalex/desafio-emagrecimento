import type { Cor, CorId, Profile } from '../types';
import { ehHex, paraClaro, paraEscuro, suave, SUPERFICIE_CLARA, SUPERFICIE_ESCURA } from './cores';

/** Paleta que cada um pode escolher. Os valores ficam em styles.css (--c-<id>, claro e escuro). */
export const CORES: { id: CorId; nome: string }[] = [
  { id: 'tangerina', nome: 'Tangerina' },
  { id: 'mirtilo', nome: 'Mirtilo' },
  { id: 'framboesa', nome: 'Framboesa' },
  { id: 'menta', nome: 'Menta' },
  { id: 'uva', nome: 'Uva' },
  { id: 'turquesa', nome: 'Turquesa' },
];

/** Ordem estável das pessoas (1 ou 2), pelo id. Usada para quem aparece primeiro. */
export function playerSlot(profiles: Pick<Profile, 'id'>[], id: string): 1 | 2 {
  const ordem = [...profiles].map((p) => p.id).sort();
  return ordem.indexOf(id) === 1 ? 2 : 1;
}

/**
 * Cor de cada pessoa: a escolhida em Configurações; sem escolha, tangerina para o 1º e mirtilo para o 2º.
 * Nunca deixa os dois com a mesma cor (quem fica sem vai para a próxima livre).
 */
export function playerColors(profiles: Pick<Profile, 'id' | 'cor'>[]): Map<string, Cor> {
  const ordem = [...profiles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const usadas = new Set<Cor>();
  const res = new Map<string, Cor>();
  for (const p of ordem) {
    if (p.cor && !usadas.has(p.cor)) {
      res.set(p.id, p.cor);
      usadas.add(p.cor);
    }
  }
  const padrao: CorId[] = ['tangerina', 'mirtilo'];
  ordem.forEach((p, i) => {
    if (res.has(p.id)) return;
    const pref: Cor = padrao[i] && !usadas.has(padrao[i]) ? padrao[i] : CORES.find((c) => !usadas.has(c.id))!.id;
    res.set(p.id, pref);
    usadas.add(pref);
  });
  return res;
}

/** Cor pronta: variável do CSS. Cor livre: light-dark() com uma versão legível para cada tema. */
export const playerVar = (cor: Cor) => (ehHex(cor) ? `light-dark(${paraClaro(cor)}, ${paraEscuro(cor)})` : `var(--c-${cor})`);

export const playerSoftVar = (cor: Cor) =>
  ehHex(cor)
    ? `light-dark(${suave(paraClaro(cor), SUPERFICIE_CLARA)}, ${suave(paraEscuro(cor), SUPERFICIE_ESCURA, 0.22)})`
    : `var(--c-${cor}-soft)`;
