import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import * as dates from '../lib/dates';
import type { DailyLog } from '../types';
import Historico from './Historico';

vi.mock('../data/repo');
vi.mock('../lib/dates', async (orig) => ({ ...(await orig<typeof import('../lib/dates')>()), todayBR: vi.fn() }));

const ch = { id: 1 as const, nome: 'X', data_inicio: '2026-11-05', data_fim: '2026-11-20' };
const log = (user_id: string, dia: string, p: Partial<DailyLog>): DailyLog => ({
  user_id, dia, cafe: false, almoco: false, lanche: false, jantar: false,
  nota_cafe: null, nota_almoco: null, nota_lanche: null, nota_jantar: null,
  atividade: false, atividade_min: 0, agua_ml: 0, meta_agua_ml_do_dia: 2000, ...p,
});

function renderHist(today: string) {
  vi.mocked(dates.todayBR).mockReturnValue(today);
  return render(
    <AppCtx.Provider value={{ userId: 'a', challenge: ch, reloadChallenge: async () => {} }}>
      <Historico />
    </AppCtx.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(repo.getProfiles).mockResolvedValue([
    { id: 'a', nome: 'Ana', meta_agua_ml: 2000 },
    { id: 'b', nome: 'Beto', meta_agua_ml: 2000 },
  ]);
  vi.mocked(repo.getLogs).mockResolvedValue([
    log('a', '2026-11-06', { almoco: true, nota_almoco: 'frango e salada', atividade: true, atividade_min: 40, agua_ml: 2250 }),
    log('b', '2026-11-07', { cafe: true }),
  ]);
});

test('lista os dias do mais recente ao início com pontos de cada um', async () => {
  renderHist('2026-11-07');
  const dias = await screen.findAllByTestId(/^dia-/);
  expect(dias.map((d) => d.dataset.testid)).toEqual(['dia-2026-11-07', 'dia-2026-11-06', 'dia-2026-11-05']);
  expect(within(dias[0]).getByLabelText('Ana: 0 de 6')).toBeInTheDocument();
  expect(within(dias[0]).getByLabelText('Beto: 1 de 6')).toBeInTheDocument();
  expect(within(dias[1]).getByLabelText('Ana: 3 de 6')).toBeInTheDocument();
  expect(within(dias[2]).getByLabelText('Beto: 0 de 6')).toBeInTheDocument();
});

test('tocar no dia mostra os detalhes com notas', async () => {
  renderHist('2026-11-07');
  await userEvent.click(await screen.findByRole('button', { name: /6 de novembro/ }));
  const det = screen.getByTestId('detalhe-2026-11-06');
  expect(within(det).getByText('frango e salada')).toBeInTheDocument();
  expect(within(det).getByText(/40 min/)).toBeInTheDocument();
  expect(within(det).getByText(/2250 \/ 2000 ml/)).toBeInTheDocument();
});

test('depois do fim lista só até o fim', async () => {
  renderHist('2026-11-25');
  const dias = await screen.findAllByTestId(/^dia-/);
  expect(dias[0].dataset.testid).toBe('dia-2026-11-20');
  expect(dias).toHaveLength(16);
});

test('antes do início avisa', async () => {
  renderHist('2026-11-01');
  expect(await screen.findByText('O desafio ainda não começou.')).toBeInTheDocument();
});
