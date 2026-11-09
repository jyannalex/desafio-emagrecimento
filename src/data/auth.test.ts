import { signUp } from './auth';

const signUpMock = vi.fn();
vi.mock('../lib/supabase', () => ({ db: () => ({ auth: { signUp: signUpMock } }) }));

test('cadastro manda o link de confirmação de volta para o próprio site', async () => {
  signUpMock.mockResolvedValue({ data: { session: null }, error: null });
  await signUp('a@x.com', '123456', 'Ana');
  expect(signUpMock).toHaveBeenCalledWith({
    email: 'a@x.com',
    password: '123456',
    options: { data: { nome: 'Ana' }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
  });
});

test('cadastro desligado no Supabase aparece em português', async () => {
  signUpMock.mockResolvedValue({ data: { session: null }, error: { message: 'Email signups are disabled' } });
  expect(await signUp('a@x.com', '123456', 'Ana')).toEqual({ error: 'Novos cadastros estão desligados no Supabase' });
});
