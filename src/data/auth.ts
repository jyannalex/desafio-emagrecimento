import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from '../lib/supabase';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const client = db();
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, loading };
}

function traduz(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos';
  if (/email not confirmed/i.test(msg)) return 'Confirme o e-mail antes de entrar';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta';
  if (/signups not allowed|signup is disabled/i.test(msg)) return 'Novos cadastros estão desligados';
  if (/at least 6 characters/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres';
  return msg;
}

/** Retorna a mensagem de erro, ou null se entrou. */
export async function signIn(email: string, senha: string): Promise<string | null> {
  const { error } = await db().auth.signInWithPassword({ email, password: senha });
  return error ? traduz(error.message) : null;
}

/** { error } em falha; { info } quando precisa confirmar o e-mail; {} quando já entrou. */
export async function signUp(email: string, senha: string, nome: string): Promise<{ error?: string; info?: string }> {
  const { data, error } = await db().auth.signUp({ email, password: senha, options: { data: { nome } } });
  if (error) return { error: traduz(error.message) };
  if (!data.session) return { info: 'Conta criada. Confirme o e-mail e depois entre.' };
  return {};
}

export async function signOut(): Promise<void> {
  await db().auth.signOut();
}
