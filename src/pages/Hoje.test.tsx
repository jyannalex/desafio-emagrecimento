import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import { addDays, todayBR } from '../lib/dates';
import type { Challenge, DailyLog } from '../types';
import Hoje from './Hoje';

vi.mock('../data/repo');

const hoje = todayBR();

function renderHoje(ch: Challenge) {
  return render(
    <ToastProvider>
      <MemoryRouter>
        <AppCtx.Provider value={{ userId: 'u1', challenge: ch, reloadChallenge: async () => {} }}>
          <Hoje />
        </AppCtx.Provider>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.mocked(repo.getProfiles).mockResolvedValue([{ id: 'u1', nome: 'Ana', meta_agua_ml: 2000 }]);
  vi.mocked(repo.getLogs).mockResolvedValue([]);
  vi.mocked(repo.upsertLog).mockImplementation(async (l: DailyLog) => l);
});

const ativo = { id: 1 as const, nome: 'X', data_inicio: addDays(hoje, -30), data_fim: addDays(hoje, 30) };

test('mostra as tarefas do dia e 0/6', async () => {
  renderHoje(ativo);
  for (const t of ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Atividade física']) {
    expect(await screen.findByLabelText(t)).toBeInTheDocument();
  }
  expect(screen.getByText('Água')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '0 de 6 pontos' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Hoje' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ontem' })).toBeInTheDocument();
});

test('marcar café soma 1 ponto e grava', async () => {
  renderHoje(ativo);
  const cafe = await screen.findByLabelText('Café da manhã');
  await waitFor(() => expect(cafe).not.toBeDisabled());
  await userEvent.click(cafe);
  expect(screen.getByRole('img', { name: '1 de 6 pontos' })).toBeInTheDocument();
  await waitFor(() => expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ cafe: true, dia: hoje })));
});

test('bater a meta de água soma ponto', async () => {
  vi.mocked(repo.getProfiles).mockResolvedValue([{ id: 'u1', nome: 'Ana', meta_agua_ml: 500 }]);
  renderHoje(ativo);
  const mais = await screen.findByRole('button', { name: '+500 ml' });
  await waitFor(() => expect(mais).not.toBeDisabled());
  await userEvent.click(mais);
  expect(screen.getByText('500 / 500 ml')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '1 de 6 pontos' })).toBeInTheDocument();
});

test('nota da refeição grava ao sair do campo', async () => {
  renderHoje(ativo);
  const nota = await screen.findByLabelText('O que comeu no almoço');
  await waitFor(() => expect(nota).not.toBeDisabled());
  await userEvent.type(nota, 'frango e salada');
  await userEvent.tab();
  await waitFor(() =>
    expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ nota_almoco: 'frango e salada' })),
  );
});

test('ontem fora do período fica travado', async () => {
  renderHoje({ ...ativo, data_inicio: hoje });
  await userEvent.click(await screen.findByRole('button', { name: 'Ontem' }));
  expect(await screen.findByText('Fora do período do desafio')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Café da manhã')).toBeDisabled());
  expect(screen.getByRole('button', { name: '+250 ml' })).toBeDisabled();
});
