import type { Profile } from '../types';

/** Cor fixa de cada pessoa (1 = tangerina, 2 = mirtilo), pela ordem estável do id. */
export function playerSlot(profiles: Pick<Profile, 'id'>[], id: string): 1 | 2 {
  const ordem = [...profiles].map((p) => p.id).sort();
  return ordem.indexOf(id) === 1 ? 2 : 1;
}

export const playerVar = (slot: 1 | 2) => (slot === 1 ? 'var(--p1)' : 'var(--p2)');
export const playerSoftVar = (slot: 1 | 2) => (slot === 1 ? 'var(--p1-soft)' : 'var(--p2-soft)');
