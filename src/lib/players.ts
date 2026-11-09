import type { CorId, Profile } from '../types';

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
export function playerColors(profiles: Pick<Profile, 'id' | 'cor'>[]): Map<string, CorId> {
  const ordem = [...profiles].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const usadas = new Set<CorId>();
  const res = new Map<string, CorId>();
  for (const p of ordem) {
    if (p.cor && !usadas.has(p.cor)) {
      res.set(p.id, p.cor);
      usadas.add(p.cor);
    }
  }
  const padrao: CorId[] = ['tangerina', 'mirtilo'];
  ordem.forEach((p, i) => {
    if (res.has(p.id)) return;
    const pref = padrao[i] && !usadas.has(padrao[i]) ? padrao[i] : CORES.find((c) => !usadas.has(c.id))!.id;
    res.set(p.id, pref);
    usadas.add(pref);
  });
  return res;
}

export const playerVar = (cor: CorId) => `var(--c-${cor})`;
export const playerSoftVar = (cor: CorId) => `var(--c-${cor}-soft)`;
