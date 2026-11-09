import { createContext, useContext } from 'react';
import type { Challenge } from '../types';

export type AppState = {
  userId: string;
  challenge: Challenge | null;
  reloadChallenge: () => Promise<void>;
};

export const AppCtx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useApp fora do AppCtx');
  return v;
}
