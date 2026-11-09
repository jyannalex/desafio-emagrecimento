import { readEnv } from './supabase';

test('readEnv retorna null sem variáveis', () => {
  expect(readEnv({})).toBeNull();
  expect(readEnv({ VITE_SUPABASE_URL: 'x' })).toBeNull();
});

test('readEnv retorna config completa', () => {
  expect(readEnv({ VITE_SUPABASE_URL: 'https://a.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }))
    .toEqual({ url: 'https://a.supabase.co', anonKey: 'k' });
});
