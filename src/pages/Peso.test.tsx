import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import { todayBR } from '../lib/dates';
import Peso, { weightDelta } from './Peso';

vi.mock('../data/repo');

const ch = { id: 1 as const, nome: 'X', data_inicio: '2026-11-01', data_fim: '2027-01-31' };

function renderPeso() {
  return render(
    <AppCtx.Provider value={{ userId: 'a', challenge: ch, reloadChallenge: async () => {} }}>
      <Peso />
    </AppCtx.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(repo.getProfiles).mockResolvedValue([
    { id: 'a', nome: 'Ana', meta_agua_ml: 2000 },
    { id: 'b', nome: 'Beto', meta_agua_ml: 2000 },
  ]);
  vi.mocked(repo.getWeights).mockResolvedValue([
    { id: 1, user_id: 'a', dia: '2026-11-01', kg: 82.36 },
    { id: 2, user_id: 'a', dia: '2026-11-10', kg: 80 },
    { id: 3, user_id: 'b', dia: '2026-11-01', kg: 95 },
  ]);
  vi.mocked(repo.upsertWeight).mockResolvedValue();
  vi.mocked(repo.deleteWeight).mockResolvedValue();
});

test('weightDelta', () => {
  expect(weightDelta([])).toBeNull();
  expect(weightDelta([{ id: 1, user_id: 'a', dia: '2026-11-01', kg: 80 }])).toBeNull();
  expect(
    weightDelta([
      { id: 1, user_id: 'a', dia: '2026-11-10', kg: 80 },
      { id: 2, user_id: 'a', dia: '2026-11-01', kg: 82.36 },
    ]),
  ).toBe(-2.4);
});

test('mostra a variação de cada um', async () => {
  renderPeso();
  expect(await screen.findByLabelText('Ana: −2,4 kg')).toBeInTheDocument();
  expect(screen.getByLabelText('Beto: só 1 pesagem')).toBeInTheDocument();
});

test('salva a pesagem com a data de hoje e vírgula decimal', async () => {
  renderPeso();
  const kg = await screen.findByLabelText('Peso (kg)');
  await userEvent.type(kg, '79,8');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar peso' }));
  await waitFor(() => expect(repo.upsertWeight).toHaveBeenCalledWith({ user_id: 'a', dia: todayBR(), kg: 79.8 }));
});

test.each(['', '0', '400', 'abc'])('peso inválido "%s" não grava', async (valor) => {
  renderPeso();
  const kg = await screen.findByLabelText('Peso (kg)');
  if (valor) await userEvent.type(kg, valor);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar peso' }));
  expect(await screen.findByText('Peso inválido')).toBeInTheDocument();
  expect(repo.upsertWeight).not.toHaveBeenCalled();
});

test('só as próprias pesagens têm botão de excluir', async () => {
  renderPeso();
  const botoes = await screen.findAllByRole('button', { name: /Excluir pesagem/ });
  expect(botoes).toHaveLength(2);
  await userEvent.click(botoes[0]);
  await waitFor(() => expect(repo.deleteWeight).toHaveBeenCalledWith(2));
});
