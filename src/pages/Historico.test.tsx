import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import * as dates from '../lib/dates';
import type { DailyLog, MealItem } from '../types';
import Historico from './Historico';

vi.mock('../data/repo');
vi.mock('../lib/dates', async (orig) => ({ ...(await orig<typeof import('../lib/dates')>()), todayBR: vi.fn() }));

const ch = { id: 1 as const, nome: 'X', data_inicio: '2026-11-05', data_fim: '2026-11-20' };
const log = (user_id: string, dia: string, p: Partial<DailyLog>): DailyLog => ({
  user_id, dia, cafe: false, almoco: false, lanche: false, jantar: false,
  nota_cafe: null, nota_almoco: null, nota_lanche: null, nota_jantar: null, nota_atividade: null,
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
    log('a', '2026-11-06', { almoco: true, nota_almoco: 'frango e salada', atividade: true, atividade_min: 40, nota_atividade: 'pedalada', agua_ml: 2250 }),
    log('b', '2026-11-07', { cafe: true }),
  ]);
  vi.mocked(repo.getPhotos).mockResolvedValue([]);
  vi.mocked(repo.photoUrls).mockResolvedValue({});
  vi.mocked(repo.getMealItems).mockResolvedValue([]);
});

test('lista os dias do mais recente ao início com pontos de cada um', async () => {
  renderHist('2026-11-07');
  const dias = await screen.findAllByTestId(/^dia-/);
  expect(dias.map((d) => d.dataset.testid)).toEqual(['dia-2026-11-07', 'dia-2026-11-06', 'dia-2026-11-05']);
  expect(within(dias[0]).getByLabelText('Ana: 0 de 5')).toBeInTheDocument();
  expect(within(dias[0]).getByLabelText('Beto: 1 de 5')).toBeInTheDocument();
  expect(within(dias[1]).getByLabelText('Ana: 2 de 5')).toBeInTheDocument();
  expect(within(dias[2]).getByLabelText('Beto: 0 de 5')).toBeInTheDocument();
});

test('tocar no dia mostra os detalhes com notas', async () => {
  renderHist('2026-11-07');
  await userEvent.click(await screen.findByRole('button', { name: /6 de novembro/ }));
  const det = screen.getByTestId('detalhe-2026-11-06');
  expect(within(det).getByText('frango e salada')).toBeInTheDocument();
  expect(within(det).getByText(/40 min/)).toBeInTheDocument();
  expect(within(det).getByText('pedalada')).toBeInTheDocument();
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

test('no detalhe do dia aparecem as fotos de cada um', async () => {
  const foto = { id: 3, user_id: 'b', dia: '2026-11-07', tarefa: 'cafe' as const, path: 'b/2026-11-07/cafe-1.jpg', bytes: 900 };
  vi.mocked(repo.getPhotos).mockResolvedValue([foto]);
  vi.mocked(repo.photoUrls).mockResolvedValue({ [foto.path]: 'https://x/cafe-beto.jpg' });
  renderHist('2026-11-07');
  await userEvent.click(await screen.findByRole('button', { name: /^Hoje/ }));
  expect(repo.getPhotos).toHaveBeenCalledWith('2026-11-07', '2026-11-07');
  await userEvent.click(await screen.findByRole('button', { name: 'Ver foto do café da manhã de Beto' }));
  const dlg = screen.getByRole('dialog', { name: 'Foto do café da manhã de Beto' });
  expect(within(dlg).getByRole('img')).toHaveAttribute('src', 'https://x/cafe-beto.jpg');
  expect(within(dlg).queryByRole('button', { name: 'Remover foto' })).not.toBeInTheDocument();
});

const item = (user_id: string, dia: string, over: Partial<MealItem> = {}): MealItem => ({
  id: Math.random(),
  user_id,
  dia,
  refeicao: 'almoco',
  food_id: 1,
  nome: 'Arroz branco cozido',
  kcal_100g: 128,
  gramas: 120,
  ...over,
});

test('no detalhe do dia aparecem os alimentos e o total de cada um', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([
    item('a', '2026-11-06'),
    item('a', '2026-11-06', { refeicao: 'jantar', nome: 'Feijão carioca cozido', kcal_100g: 76, gramas: 140 }),
    item('b', '2026-11-06', { refeicao: 'cafe', nome: 'Pão francês', kcal_100g: 300, gramas: 50 }),
  ]);
  renderHist('2026-11-07');
  await userEvent.click(await screen.findByRole('button', { name: /6 de novembro/ }));
  expect(repo.getMealItems).toHaveBeenCalledWith('2026-11-06', '2026-11-06');
  const det = screen.getByTestId('detalhe-2026-11-06');
  const [ana, beto] = within(det).getAllByRole('heading', { level: 3 }).map((h) => h.closest('.detail-col') as HTMLElement);
  expect(await within(ana).findByText('Arroz branco cozido · 120 g · 154 kcal')).toBeInTheDocument();
  expect(within(ana).getByText('Feijão carioca cozido · 140 g · 106 kcal')).toBeInTheDocument();
  expect(within(ana).getByText('Total: 260 kcal')).toBeInTheDocument();
  // Beto não tem registro do dia, mas registrou alimento: aparece mesmo assim
  expect(within(beto).getByText('Pão francês · 50 g · 150 kcal')).toBeInTheDocument();
  expect(within(beto).getByText('Total: 150 kcal')).toBeInTheDocument();
});

test('sem alimentos não mostra total', async () => {
  renderHist('2026-11-07');
  await userEvent.click(await screen.findByRole('button', { name: /6 de novembro/ }));
  const det = screen.getByTestId('detalhe-2026-11-06');
  expect(within(det).queryByText(/^Total:/)).not.toBeInTheDocument();
});
