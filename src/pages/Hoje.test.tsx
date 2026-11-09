import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import { addDays, todayBR } from '../lib/dates';
import type { Challenge, DailyLog } from '../types';
import { compressImage } from '../lib/imagem';
import Hoje from './Hoje';

vi.mock('../data/repo');
vi.mock('../lib/imagem', () => ({ compressImage: vi.fn(async () => new Blob(['reduzida'], { type: 'image/jpeg' })) }));

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
  vi.mocked(repo.getPhotos).mockResolvedValue([]);
  vi.mocked(repo.photoUrls).mockResolvedValue({});
  URL.createObjectURL = vi.fn(() => 'blob:previa');
});

const ativo = { id: 1 as const, nome: 'X', data_inicio: addDays(hoje, -30), data_fim: addDays(hoje, 30) };

test('mostra as tarefas do dia e 0/5', async () => {
  renderHoje(ativo);
  for (const t of ['Café da manhã', 'Almoço', 'Lanche', 'Jantar']) {
    expect(await screen.findByLabelText(t)).toBeInTheDocument();
  }
  expect(screen.getByText('Água')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '0 de 5 pontos' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dia anterior' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Próximo dia' })).toBeDisabled();
  expect(screen.getByLabelText('Escolher data')).toHaveValue(hoje);
});

test('marcar café soma 1 ponto e grava', async () => {
  renderHoje(ativo);
  const cafe = await screen.findByLabelText('Café da manhã');
  await waitFor(() => expect(cafe).not.toBeDisabled());
  await userEvent.click(cafe);
  expect(screen.getByRole('img', { name: '1 de 5 pontos' })).toBeInTheDocument();
  await waitFor(() => expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ cafe: true, dia: hoje })));
});

test('bater a meta de água soma ponto', async () => {
  vi.mocked(repo.getProfiles).mockResolvedValue([{ id: 'u1', nome: 'Ana', meta_agua_ml: 500 }]);
  renderHoje(ativo);
  const mais = await screen.findByRole('button', { name: '+500 ml' });
  await waitFor(() => expect(mais).not.toBeDisabled());
  await userEvent.click(mais);
  expect(screen.getByText('500 / 500 ml')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '1 de 5 pontos' })).toBeInTheDocument();
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
  expect(screen.getByRole('img', { name: '0 de 5 pontos' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '+1 h' }));
  expect(screen.getByText('100 / 60 min')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '1 de 5 pontos' })).toBeInTheDocument();
  await waitFor(() =>
    expect(repo.upsertLog).toHaveBeenLastCalledWith(expect.objectContaining({ atividade_min: 100, atividade: true })),
  );
});

test('lanche grava mas não vale ponto', async () => {
  renderHoje(ativo);
  const lanche = await screen.findByLabelText('Lanche');
  await waitFor(() => expect(lanche).not.toBeDisabled());
  expect(screen.getByText('sem ponto')).toBeInTheDocument();
  await userEvent.click(lanche);
  expect(screen.getByRole('img', { name: '0 de 5 pontos' })).toBeInTheDocument();
  expect(screen.getByText('0 de 3 na dieta')).toBeInTheDocument();
  await waitFor(() => expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ lanche: true })));
});

const fotoCafe = { id: 9, user_id: 'u1', dia: hoje, tarefa: 'cafe' as const, path: `u1/${hoje}/cafe-1.jpg`, bytes: 1000 };

test('foto do almoço: reduz, envia e mostra a miniatura', async () => {
  vi.mocked(repo.uploadPhoto).mockResolvedValue({ ...fotoCafe, id: 10, tarefa: 'almoco', path: `u1/${hoje}/almoco-2.jpg` });
  renderHoje(ativo);
  const escolher = await screen.findByLabelText('Adicionar foto do almoço');
  await waitFor(() => expect(escolher).not.toBeDisabled());
  const arquivo = new File(['x'], 'almoco.jpg', { type: 'image/jpeg' });
  await userEvent.upload(escolher, arquivo);
  await waitFor(() => expect(repo.uploadPhoto).toHaveBeenCalledWith('u1', hoje, 'almoco', expect.any(Blob)));
  expect(compressImage).toHaveBeenCalledWith(arquivo);
  expect(await screen.findByRole('button', { name: 'Ver foto do almoço' })).toBeInTheDocument();
});

test('tem foto da atividade também', async () => {
  renderHoje(ativo);
  expect(await screen.findByLabelText('Adicionar foto da atividade')).toBeInTheDocument();
});

test('abre a foto e remove', async () => {
  vi.mocked(repo.getPhotos).mockResolvedValue([fotoCafe]);
  vi.mocked(repo.photoUrls).mockResolvedValue({ [fotoCafe.path]: 'https://x/cafe.jpg' });
  vi.mocked(repo.deletePhoto).mockResolvedValue();
  renderHoje(ativo);
  await userEvent.click(await screen.findByRole('button', { name: 'Ver foto do café da manhã' }));
  const dialogo = screen.getByRole('dialog', { name: 'Foto do café da manhã' });
  expect(dialogo.querySelector('img')).toHaveAttribute('src', 'https://x/cafe.jpg');
  await userEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
  await waitFor(() => expect(repo.deletePhoto).toHaveBeenCalledWith(fotoCafe));
  expect(await screen.findByLabelText('Adicionar foto do café da manhã')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('falha ao enviar foto avisa', async () => {
  vi.mocked(repo.uploadPhoto).mockRejectedValue(new Error('rede'));
  renderHoje(ativo);
  const escolher = await screen.findByLabelText('Adicionar foto do jantar');
  await waitFor(() => expect(escolher).not.toBeDisabled());
  await userEvent.upload(escolher, new File(['x'], 'j.jpg', { type: 'image/jpeg' }));
  expect(await screen.findByText('A foto não foi enviada, tente de novo')).toBeInTheDocument();
  expect(screen.getByLabelText('Adicionar foto do jantar')).toBeInTheDocument();
});
