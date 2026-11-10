import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as auth from '../data/auth';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import { todayBR } from '../lib/dates';
import type { Challenge, Food } from '../types';
import { within } from '@testing-library/react';
import Config from './Config';

vi.mock('../data/repo');
vi.mock('../data/auth');

const reloadChallenge = vi.fn(async () => {});

function renderConfig(challenge: Challenge | null) {
  return render(
    <AppCtx.Provider value={{ userId: 'a', challenge, reloadChallenge }}>
      <MemoryRouter initialEntries={['/config']}>
        <Routes>
          <Route path="/config" element={<Config />} />
          <Route path="/" element={<p>Página Hoje</p>} />
        </Routes>
      </MemoryRouter>
    </AppCtx.Provider>,
  );
}

beforeEach(() => {
  vi.mocked(repo.getProfiles).mockResolvedValue([{ id: 'a', nome: 'Ana', meta_agua_ml: 2000 }]);
  vi.mocked(repo.saveChallenge).mockResolvedValue();
  vi.mocked(repo.updateProfile).mockResolvedValue();
  vi.mocked(repo.myPhotoStats).mockResolvedValue({ count: 0, bytes: 0 });
  vi.mocked(repo.deletePhotosUntil).mockResolvedValue(0);
  catalogo = [];
  vi.mocked(repo.getFoods).mockImplementation(async () => catalogo);
  vi.mocked(repo.recentFoods).mockResolvedValue([]);
});

let catalogo: Food[] = [];

async function preencherDesafio(nome: string, inicio: string, fim: string) {
  await userEvent.clear(screen.getByLabelText('Nome do desafio'));
  await userEvent.type(screen.getByLabelText('Nome do desafio'), nome);
  await userEvent.clear(screen.getByLabelText('Início'));
  await userEvent.type(screen.getByLabelText('Início'), inicio);
  await userEvent.clear(screen.getByLabelText('Fim'));
  await userEvent.type(screen.getByLabelText('Fim'), fim);
}

test('sem desafio: configura e vai para Hoje', async () => {
  renderConfig(null);
  expect(await screen.findByText('Configurar desafio')).toBeInTheDocument();
  await preencherDesafio('Verão', '2026-11-10', '2027-02-07');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar desafio' }));
  await waitFor(() =>
    expect(repo.saveChallenge).toHaveBeenCalledWith({ nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07', premio: null }),
  );
  expect(reloadChallenge).toHaveBeenCalled();
  expect(await screen.findByText('Página Hoje')).toBeInTheDocument();
});

test('fim antes do início não grava', async () => {
  renderConfig(null);
  await screen.findByText('Configurar desafio');
  await preencherDesafio('Verão', '2026-11-10', '2026-11-01');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar desafio' }));
  expect(await screen.findByText('A data de fim deve ser depois do início')).toBeInTheDocument();
  expect(repo.saveChallenge).not.toHaveBeenCalled();
});

test('com desafio: mostra os dados atuais', async () => {
  renderConfig({ id: 1, nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' });
  expect(await screen.findByText('Configurações')).toBeInTheDocument();
  expect(screen.getByLabelText('Nome do desafio')).toHaveValue('Verão');
  expect(screen.getByLabelText('Início')).toHaveValue('2026-11-10');
});

test('salva meta de água e nome', async () => {
  renderConfig({ id: 1, nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' });
  const meta = await screen.findByLabelText('Meta de água (ml)');
  await waitFor(() => expect(meta).toHaveValue(2000));
  await userEvent.clear(meta);
  await userEvent.type(meta, '2500');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
  await waitFor(() => expect(repo.updateProfile).toHaveBeenCalledWith('a', { nome: 'Ana', meta_agua_ml: 2500 }));
  expect(await screen.findByText('Perfil salvo')).toBeInTheDocument();
});

test.each(['0', '-5', ''])('meta de água inválida "%s" não grava', async (v) => {
  renderConfig({ id: 1, nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' });
  const meta = await screen.findByLabelText('Meta de água (ml)');
  await waitFor(() => expect(meta).toHaveValue(2000));
  await userEvent.clear(meta);
  if (v) await userEvent.type(meta, v);
  await userEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
  expect(await screen.findByText('A meta de água deve ser maior que zero')).toBeInTheDocument();
  expect(repo.updateProfile).not.toHaveBeenCalled();
});

test('sair', async () => {
  renderConfig({ id: 1, nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' });
  await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));
  expect(auth.signOut).toHaveBeenCalled();
});

test('tema escuro aplica no app e fica marcado', async () => {
  renderConfig({ id: 1, nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' });
  await userEvent.click(await screen.findByRole('button', { name: 'Escuro' }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByRole('button', { name: 'Escuro' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'Automático' }));
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

const ch: Challenge = { id: 1, nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' };

test('escolher a minha cor grava na hora; a cor do outro fica bloqueada', async () => {
  vi.mocked(repo.getProfiles).mockResolvedValue([
    { id: 'a', nome: 'Ana', meta_agua_ml: 2000, cor: null },
    { id: 'b', nome: 'Beto', meta_agua_ml: 2000, cor: 'menta' },
  ]);
  renderConfig(ch);
  const grupo = await screen.findByRole('group', { name: 'Minha cor' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tangerina' })).toHaveAttribute('aria-pressed', 'true'));
  expect(grupo).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Menta (cor de Beto)' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Uva' }));
  await waitFor(() => expect(repo.updateProfile).toHaveBeenCalledWith('a', { cor: 'uva' }));
  expect(screen.getByRole('button', { name: 'Uva' })).toHaveAttribute('aria-pressed', 'true');
});

test('mostra quanto as minhas fotos ocupam e apaga até a data escolhida', async () => {
  vi.mocked(repo.myPhotoStats).mockResolvedValueOnce({ count: 3, bytes: 630_000 }).mockResolvedValue({ count: 0, bytes: 0 });
  vi.mocked(repo.deletePhotosUntil).mockResolvedValue(3);
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderConfig(ch);
  expect(await screen.findByText('3 fotos, 0,6 MB')).toBeInTheDocument();
  expect(screen.getByLabelText('Apagar fotos até o dia')).toHaveValue(todayBR());
  await userEvent.click(screen.getByRole('button', { name: 'Apagar minhas fotos' }));
  expect(confirmar).toHaveBeenCalled();
  await waitFor(() => expect(repo.deletePhotosUntil).toHaveBeenCalledWith('a', todayBR()));
  expect(await screen.findByText('3 fotos apagadas')).toBeInTheDocument();
  expect(await screen.findByText('Nenhuma foto sua guardada')).toBeInTheDocument();
  confirmar.mockRestore();
});

test('cancelar a confirmação não apaga fotos', async () => {
  vi.mocked(repo.myPhotoStats).mockResolvedValue({ count: 1, bytes: 200_000 });
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderConfig(ch);
  await userEvent.click(await screen.findByRole('button', { name: 'Apagar minhas fotos' }));
  expect(repo.deletePhotosUntil).not.toHaveBeenCalled();
  confirmar.mockRestore();
});

test('outra cor: escolher no seletor grava a cor livre', async () => {
  vi.mocked(repo.getProfiles).mockResolvedValue([
    { id: 'a', nome: 'Ana', meta_agua_ml: 2000, cor: null },
    { id: 'b', nome: 'Beto', meta_agua_ml: 2000, cor: '#00aa55' },
  ]);
  renderConfig(ch);
  const seletor = await screen.findByLabelText('Outra cor');
  await waitFor(() => expect(seletor).not.toBeDisabled());
  fireEvent.change(seletor, { target: { value: '#C0FFEE' } });
  await waitFor(() => expect(repo.updateProfile).toHaveBeenCalledWith('a', { cor: '#c0ffee' }), { timeout: 2000 });
  expect(seletor.closest('.swatch')).toHaveClass('on');
});

test('outra cor igual à do outro não grava', async () => {
  vi.mocked(repo.getProfiles).mockResolvedValue([
    { id: 'a', nome: 'Ana', meta_agua_ml: 2000, cor: null },
    { id: 'b', nome: 'Beto', meta_agua_ml: 2000, cor: '#00aa55' },
  ]);
  renderConfig(ch);
  const seletor = await screen.findByLabelText('Outra cor');
  await waitFor(() => expect(seletor).not.toBeDisabled());
  fireEvent.change(seletor, { target: { value: '#00aa55' } });
  expect(await screen.findByText('Essa é a cor de Beto, escolha outra')).toBeInTheDocument();
  await new Promise((r) => setTimeout(r, 700));
  expect(repo.updateProfile).not.toHaveBeenCalled();
});

// ---------- meus alimentos ----------

const desafio = { id: 1 as const, nome: 'X', data_inicio: '2026-11-01', data_fim: '2026-12-31' };
const custom = (id: number, nome: string, kcal_100g: number | null, criado_por: string, kcal_unidade: number | null = null): Food => ({
  id,
  nome,
  kcal_100g,
  kcal_unidade,
  origem: 'custom',
  criado_por,
});

test('meus alimentos: lista só os que eu cadastrei', async () => {
  catalogo = [
    { id: 1, nome: 'Arroz branco cozido', kcal_100g: 128, kcal_unidade: null, origem: 'taco', criado_por: null },
    custom(50, 'Marmita da tia', 400, 'a'),
    custom(51, 'Bolo do Beto', 300, 'b'),
  ];
  renderConfig(desafio);
  const painel = (await screen.findByRole('heading', { name: 'Meus alimentos' })).closest('section')!;
  expect(await within(painel).findByText('Marmita da tia')).toBeInTheDocument();
  expect(within(painel).getByText('400 kcal/100 g')).toBeInTheDocument();
  expect(within(painel).queryByText('Bolo do Beto')).not.toBeInTheDocument();
  expect(within(painel).queryByText('Arroz branco cozido')).not.toBeInTheDocument();
});

test('meus alimentos: vazio convida a cadastrar', async () => {
  renderConfig(desafio);
  expect(await screen.findByText('Você ainda não cadastrou nenhum alimento')).toBeInTheDocument();
});

test('meus alimentos: cadastrar', async () => {
  vi.mocked(repo.createFood).mockImplementation(async (x) => {
    const f = { ...x, id: 60, origem: 'custom' as const };
    catalogo = [...catalogo, f];
    return f;
  });
  renderConfig(desafio);
  await userEvent.click(await screen.findByRole('button', { name: 'Cadastrar alimento' }));
  const dlg = screen.getByRole('dialog', { name: 'Cadastrar alimento' });
  await userEvent.type(within(dlg).getByLabelText('Nome'), 'Pão da padaria');
  await userEvent.type(within(dlg).getByLabelText('Calorias (kcal)'), '280');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alimento' }));
  expect(repo.createFood).toHaveBeenCalledWith({ nome: 'Pão da padaria', kcal_100g: 280, kcal_unidade: null, criado_por: 'a' });
  expect(await screen.findByText('Pão da padaria')).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('meus alimentos: editar', async () => {
  catalogo = [custom(50, 'Marmita da tia', 400, 'a')];
  vi.mocked(repo.updateFood).mockImplementation(async (id, x) => {
    const f = { ...custom(id, x.nome, x.kcal_100g, 'a', x.kcal_unidade) };
    catalogo = [f];
    return f;
  });
  renderConfig(desafio);
  await userEvent.click(await screen.findByRole('button', { name: 'Editar Marmita da tia' }));
  const dlg = screen.getByRole('dialog', { name: 'Editar alimento' });
  expect(within(dlg).getByLabelText('Nome')).toHaveValue('Marmita da tia');
  expect(within(dlg).getByLabelText('Calorias (kcal)')).toHaveValue('400');
  await userEvent.clear(within(dlg).getByLabelText('Calorias (kcal)'));
  await userEvent.type(within(dlg).getByLabelText('Calorias (kcal)'), '350');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alimento' }));
  expect(repo.updateFood).toHaveBeenCalledWith(50, { nome: 'Marmita da tia', kcal_100g: 350, kcal_unidade: null });
  expect(await screen.findByText('350 kcal/100 g')).toBeInTheDocument();
});

test('meus alimentos: apagar pede confirmação', async () => {
  catalogo = [custom(50, 'Marmita da tia', 400, 'a')];
  vi.mocked(repo.deleteFood).mockImplementation(async () => {
    catalogo = [];
  });
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderConfig(desafio);
  await userEvent.click(await screen.findByRole('button', { name: 'Apagar Marmita da tia' }));
  expect(confirmar).toHaveBeenCalled();
  expect(repo.deleteFood).toHaveBeenCalledWith(50);
  await waitFor(() => expect(screen.queryByText('Marmita da tia')).not.toBeInTheDocument());
  confirmar.mockRestore();
});

test('desafio: grava o prêmio', async () => {
  renderConfig({ ...desafio, premio: 'Jantar no japonês' });
  const premio = await screen.findByLabelText('Prêmio do desafio');
  expect(premio).toHaveValue('Jantar no japonês');
  await userEvent.clear(premio);
  await userEvent.type(premio, '  Viagem para a praia ');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar desafio' }));
  await waitFor(() =>
    expect(repo.saveChallenge).toHaveBeenCalledWith({ nome: 'X', data_inicio: '2026-11-01', data_fim: '2026-12-31', premio: 'Viagem para a praia' }),
  );
});

test('meus alimentos: alimento por unidade mostra kcal por unidade e edita por unidade', async () => {
  catalogo = [custom(70, 'Coxinha', null, 'a', 250)];
  vi.mocked(repo.updateFood).mockImplementation(async (id, x) => {
    const f = custom(id, x.nome, x.kcal_100g, 'a', x.kcal_unidade);
    catalogo = [f];
    return f;
  });
  renderConfig(desafio);
  expect(await screen.findByText('250 kcal/un')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Editar Coxinha' }));
  const dlg = screen.getByRole('dialog', { name: 'Editar alimento' });
  expect(within(dlg).getByRole('button', { name: 'Por unidade' })).toHaveAttribute('aria-pressed', 'true');
  const kcal = within(dlg).getByLabelText('Calorias de 1 unidade (kcal)');
  expect(kcal).toHaveValue('250');
  await userEvent.clear(kcal);
  await userEvent.type(kcal, '280');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alimento' }));
  expect(repo.updateFood).toHaveBeenCalledWith(70, { nome: 'Coxinha', kcal_100g: null, kcal_unidade: 280 });
  expect(await screen.findByText('280 kcal/un')).toBeInTheDocument();
});
