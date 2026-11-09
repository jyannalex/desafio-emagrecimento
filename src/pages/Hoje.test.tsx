import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  for (const t of ['Café da manhã', 'Almoço', 'Lanche', 'Jantar']) {
    expect(await screen.findByLabelText(t)).toBeInTheDocument();
  }
  expect(screen.getByText('Água')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '0 de 6 pontos' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dia anterior' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled();
  expect(screen.getByLabelText('Escolher data')).toHaveValue(hoje);
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

test('não volta antes do início do desafio nem passa de hoje', async () => {
  renderHoje({ ...ativo, data_inicio: hoje });
  expect(await screen.findByRole('button', { name: 'Dia anterior' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled();
  const data = screen.getByLabelText('Escolher data');
  expect(data).toHaveAttribute('min', hoje);
  expect(data).toHaveAttribute('max', hoje);
});

test('volta um dia e depois escolhe uma data antiga, ambos editáveis', async () => {
  renderHoje(ativo);
  await userEvent.click(await screen.findByRole('button', { name: 'Dia anterior' }));
  expect(await screen.findByRole('heading', { name: 'Ontem' })).toBeInTheDocument();
  await waitFor(() => expect(repo.getLogs).toHaveBeenCalledWith(addDays(hoje, -1), addDays(hoje, -1)));

  const antigo = addDays(hoje, -10);
  fireEvent.change(screen.getByLabelText('Escolher data'), { target: { value: antigo } });
  await waitFor(() => expect(repo.getLogs).toHaveBeenCalledWith(antigo, antigo));
  const cafe = screen.getByLabelText('Café da manhã');
  await waitFor(() => expect(cafe).not.toBeDisabled());
  await userEvent.click(cafe);
  await waitFor(() => expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ dia: antigo, cafe: true })));

  await userEvent.click(screen.getByRole('button', { name: 'Voltar para hoje' }));
  expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument();
});

test('data fora do período digitada é ignorada', async () => {
  renderHoje(ativo);
  const data = await screen.findByLabelText('Escolher data');
  fireEvent.change(data, { target: { value: addDays(hoje, 3) } });
  expect(screen.getByRole('heading', { name: 'Hoje' })).toBeInTheDocument();
});

test('nota da atividade grava ao sair do campo', async () => {
  renderHoje(ativo);
  const nota = await screen.findByLabelText('Qual atividade você fez');
  await waitFor(() => expect(nota).not.toBeDisabled());
  await userEvent.type(nota, 'caminhada no parque');
  await userEvent.tab();
  await waitFor(() =>
    expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ nota_atividade: 'caminhada no parque' })),
  );
});

test('atividade soma minutos com botões e pontua só com 1 hora', async () => {
  renderHoje(ativo);
  expect(await screen.findByText('Atividade física')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Atividade física' })).not.toBeInTheDocument();
  const mais10 = screen.getByRole('button', { name: '+10 min' });
  await waitFor(() => expect(mais10).not.toBeDisabled());
  expect(screen.getByRole('button', { name: '−10 min' })).toBeDisabled();
  await userEvent.click(mais10);
  await userEvent.click(screen.getByRole('button', { name: '+30 min' }));
  expect(screen.getByText('40 / 60 min')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '0 de 6 pontos' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '+1 h' }));
  expect(screen.getByText('100 / 60 min')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '1 de 6 pontos' })).toBeInTheDocument();
  await waitFor(() =>
    expect(repo.upsertLog).toHaveBeenLastCalledWith(expect.objectContaining({ atividade_min: 100, atividade: true })),
  );
});
