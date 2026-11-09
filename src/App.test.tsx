import { render, screen } from '@testing-library/react';
import App from './App';
import * as auth from './data/auth';
import * as repo from './data/repo';

vi.mock('./data/auth');
vi.mock('./data/repo');

const session = { user: { id: 'u1' } } as any;
const ch = { id: 1 as const, nome: 'Nosso', data_inicio: '2026-11-01', data_fim: '2027-01-31' };

beforeEach(() => {
  vi.mocked(repo.getProfiles).mockResolvedValue([]);
  vi.mocked(repo.getLogs).mockResolvedValue([]);
  vi.mocked(repo.getWeights).mockResolvedValue([]);
  window.location.hash = '#/';
});

test('sem sessão mostra a tela de login', async () => {
  vi.mocked(auth.useSession).mockReturnValue({ session: null, loading: false });
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
});

test('com sessão e sem desafio leva para configurar', async () => {
  vi.mocked(auth.useSession).mockReturnValue({ session, loading: false });
  vi.mocked(repo.getChallenge).mockResolvedValue(null);
  render(<App />);
  expect(await screen.findByText('Configurar desafio')).toBeInTheDocument();
});

test('com sessão e desafio mostra a navegação', async () => {
  vi.mocked(auth.useSession).mockReturnValue({ session, loading: false });
  vi.mocked(repo.getChallenge).mockResolvedValue(ch);
  render(<App />);
  for (const name of ['Hoje', 'Ranking', 'Histórico', 'Peso', 'Config']) {
    expect(await screen.findByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
  }
});

test('erro ao carregar o desafio mostra tentar de novo', async () => {
  vi.mocked(auth.useSession).mockReturnValue({ session, loading: false });
  vi.mocked(repo.getChallenge).mockRejectedValue(new Error('offline'));
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
});
