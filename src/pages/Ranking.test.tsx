import { render, screen, within } from '@testing-library/react';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import * as dates from '../lib/dates';
import type { DailyLog } from '../types';
import Ranking from './Ranking';

vi.mock('../data/repo');
vi.mock('../lib/dates', async (orig) => ({ ...(await orig<typeof import('../lib/dates')>()), todayBR: vi.fn() }));

const ch = { id: 1 as const, nome: 'Verão', data_inicio: '2026-11-05', data_fim: '2026-11-20' };
const log = (user_id: string, dia: string, p: Partial<DailyLog>): DailyLog => ({
  user_id, dia, cafe: false, almoco: false, lanche: false, jantar: false,
  nota_cafe: null, nota_almoco: null, nota_lanche: null, nota_jantar: null,
  atividade: false, atividade_min: 0, agua_ml: 0, meta_agua_ml_do_dia: 2000, ...p,
});

function renderRanking(today: string) {
  vi.mocked(dates.todayBR).mockReturnValue(today);
  return render(
    <AppCtx.Provider value={{ userId: 'a', challenge: ch, reloadChallenge: async () => {} }}>
      <Ranking />
    </AppCtx.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(repo.getProfiles).mockResolvedValue([
    { id: 'a', nome: 'Ana', meta_agua_ml: 2000 },
    { id: 'b', nome: 'Beto', meta_agua_ml: 2000 },
  ]);
  vi.mocked(repo.getLogs).mockResolvedValue([
    log('a', '2026-11-05', { cafe: true }),
    log('a', '2026-11-08', { cafe: true, almoco: true }),
    log('b', '2026-11-06', { cafe: true, almoco: true, lanche: true, jantar: true }),
  ]);
});

test('em andamento mostra placar de cada um e dias restantes', async () => {
  renderRanking('2026-11-08');
  const ana = await screen.findByTestId('placar-a');
  expect(within(ana).getByText('Ana')).toBeInTheDocument();
  expect(within(ana).getByTestId('total')).toHaveTextContent('3 pts · 13%');
  expect(within(ana).getByTestId('semana')).toHaveTextContent('3 pts · 13%');
  expect(within(ana).getByTestId('hoje')).toHaveTextContent('2 pts · 33%');
  const beto = screen.getByTestId('placar-b');
  expect(within(beto).getByTestId('total')).toHaveTextContent('4 pts · 17%');
  expect(screen.getByText('Faltam 12 dias')).toBeInTheDocument();
  expect(screen.getByText(/Beto na frente/)).toBeInTheDocument();
});

test('antes de começar', async () => {
  renderRanking('2026-11-01');
  expect(await screen.findByText('Começa em 4 dias')).toBeInTheDocument();
});

test('encerrado com vencedor', async () => {
  renderRanking('2026-11-25');
  expect(await screen.findByText('🏆 Beto venceu!')).toBeInTheDocument();
});

test('encerrado empatado', async () => {
  vi.mocked(repo.getLogs).mockResolvedValue([log('a', '2026-11-05', { cafe: true }), log('b', '2026-11-05', { almoco: true })]);
  renderRanking('2026-11-25');
  expect(await screen.findByText('Empate')).toBeInTheDocument();
});

test('erro ao carregar mostra tentar de novo', async () => {
  vi.mocked(repo.getLogs).mockRejectedValue(new Error('x'));
  renderRanking('2026-11-08');
  expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
});
