import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function readEnv(env: Record<string, string | undefined>): { url: string; anonKey: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

const cfg = readEnv(import.meta.env as Record<string, string | undefined>);

export const supabase: SupabaseClient | null = cfg ? createClient(cfg.url, cfg.anonKey) : null;

/** Cliente garantido (o app só monta quando a configuração existe). */
export function db(): SupabaseClient {
  if (!supabase) throw new Error('Supabase não configurado');
  return supabase;
}
