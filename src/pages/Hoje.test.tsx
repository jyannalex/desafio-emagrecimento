import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import { addDays, todayBR } from '../lib/dates';
import { within } from '@testing-library/react';
import type { Challenge, DailyLog, MealItem } from '../types';
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
  vi.mocked(repo.getFoods).mockResolvedValue([{ id: 1, nome: 'Arroz branco cozido', kcal_100g: 128, origem: 'taco', criado_por: null }]);
  vi.mocked(repo.getMealItems).mockResolvedValue([]);
  vi.mocked(repo.recentFoodIds).mockResolvedValue([]);
  vi.mocked(repo.addMealItem).mockImplementation(async (i) => ({ ...i, id: 77 }));
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

test('marcar café (que já tem alimento) soma 1 ponto e grava', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([
    { id: 5, user_id: 'u1', dia: hoje, refeicao: 'cafe', food_id: 1, nome: 'Arroz branco cozido', kcal_100g: 128, gramas: 50 },
  ]);
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

test('refeições não têm mais o campo de anotar', async () => {
  renderHoje(ativo);
  await screen.findByLabelText('Almoço');
  expect(screen.queryByLabelText('O que comeu no almoço')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Adicionar foto do almoço')).toBeInTheDocument();
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
  vi.mocked(repo.getMealItems).mockImplementation(async (d) => [
    { id: 5, user_id: 'u1', dia: d, refeicao: 'cafe', food_id: 1, nome: 'Arroz branco cozido', kcal_100g: 128, gramas: 50 },
  ]);
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
  vi.mocked(repo.getMealItems).mockResolvedValue([
    { id: 5, user_id: 'u1', dia: hoje, refeicao: 'lanche', food_id: 1, nome: 'Arroz branco cozido', kcal_100g: 128, gramas: 50 },
  ]);
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

// ---------- alimentos e calorias ----------

const item = (over: Partial<MealItem>): MealItem => ({
  id: 1,
  user_id: 'u1',
  dia: hoje,
  refeicao: 'almoco',
  food_id: 1,
  nome: 'Arroz branco cozido',
  kcal_100g: 128,
  gramas: 120,
  ...over,
});

test('itens do almoço mostram subtotal e o total do dia, sem mudar pontos', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([
    item({}),
    item({ id: 2, food_id: 2, nome: 'Feijão carioca cozido', kcal_100g: 76, gramas: 140 }),
  ]);
  renderHoje(ativo);
  expect(await screen.findByText('260 kcal hoje')).toBeInTheDocument();
  expect(screen.getByText('260 kcal')).toBeInTheDocument();
  expect(screen.getByText('Feijão carioca cozido')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '0 de 5 pontos' })).toBeInTheDocument();
  expect(repo.getMealItems).toHaveBeenCalledWith(hoje, hoje, 'u1');
});

test('adicionar alimento no almoço atualiza o total do dia', async () => {
  renderHoje(ativo);
  const add = await screen.findByRole('button', { name: 'Adicionar alimento no almoço' });
  await userEvent.click(add);
  const dlg = screen.getByRole('dialog', { name: 'Adicionar alimento' });
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(await within(dlg).findByRole('button', { name: /Arroz branco cozido/ }));
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByText('154 kcal hoje')).toBeInTheDocument();
  expect(repo.addMealItem).toHaveBeenCalledWith(expect.objectContaining({ refeicao: 'almoco', dia: hoje, gramas: 120 }));
});

test('cada refeição tem o botão de adicionar alimento', async () => {
  renderHoje(ativo);
  for (const r of ['café da manhã', 'almoço', 'lanche', 'jantar']) {
    expect(await screen.findByRole('button', { name: `Adicionar alimento no ${r}` })).toBeInTheDocument();
  }
});

test('dia travado mostra os itens sem botões de alimento', async () => {
  const naoComecou = { ...ativo, data_inicio: addDays(hoje, 1), data_fim: addDays(hoje, 30) };
  vi.mocked(repo.getMealItems).mockResolvedValue([item({})]);
  renderHoje(naoComecou);
  expect(await screen.findByText('Arroz branco cozido')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Adicionar alimento/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Arroz branco cozido,/ })).not.toBeInTheDocument();
});

test('se os alimentos do dia não carregam, avisa e não deixa lançar até carregar', async () => {
  vi.mocked(repo.getMealItems).mockRejectedValueOnce(new Error('rede')).mockResolvedValue([item({})]);
  renderHoje(ativo);
  expect(await screen.findByText('Não foi possível carregar os alimentos do dia.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Adicionar alimento/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Carregar alimentos de novo' }));
  expect(await screen.findByText('154 kcal hoje')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Adicionar alimento no almoço' })).toBeInTheDocument();
});

test('marcar refeição sem alimento abre a busca e só marca depois de adicionar', async () => {
  renderHoje(ativo);
  const almoco = await screen.findByLabelText('Almoço');
  await waitFor(() => expect(almoco).not.toBeDisabled());
  await userEvent.click(almoco);
  const dlg = screen.getByRole('dialog', { name: 'Adicionar alimento' });
  expect(almoco).not.toBeChecked();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(await within(dlg).findByRole('button', { name: /Arroz branco cozido/ }));
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  await waitFor(() => expect(almoco).toBeChecked());
  await waitFor(() => expect(repo.upsertLog).toHaveBeenCalledWith(expect.objectContaining({ almoco: true })));
  expect(screen.getByRole('img', { name: '1 de 5 pontos' })).toBeInTheDocument();
});

test('fechar a busca sem adicionar deixa a refeição desmarcada', async () => {
  renderHoje(ativo);
  const almoco = await screen.findByLabelText('Almoço');
  await waitFor(() => expect(almoco).not.toBeDisabled());
  await userEvent.click(almoco);
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));
  expect(almoco).not.toBeChecked();
  expect(repo.upsertLog).not.toHaveBeenCalledWith(expect.objectContaining({ almoco: true }));
});

test('adicionar pelo + Alimento não marca a refeição sozinho', async () => {
  renderHoje(ativo);
  await userEvent.click(await screen.findByRole('button', { name: 'Adicionar alimento no almoço' }));
  const dlg = screen.getByRole('dialog', { name: 'Adicionar alimento' });
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(await within(dlg).findByRole('button', { name: /Arroz branco cozido/ }));
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByText('154 kcal hoje')).toBeInTheDocument();
  expect(screen.getByLabelText('Almoço')).not.toBeChecked();
});

test('se o alimento não salvar, a refeição não é marcada', async () => {
  vi.mocked(repo.addMealItem).mockRejectedValue(new Error('rede'));
  renderHoje(ativo);
  const almoco = await screen.findByLabelText('Almoço');
  await waitFor(() => expect(almoco).not.toBeDisabled());
  await userEvent.click(almoco);
  const dlg = screen.getByRole('dialog', { name: 'Adicionar alimento' });
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(await within(dlg).findByRole('button', { name: /Arroz branco cozido/ }));
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi salvo, tente de novo');
  expect(almoco).not.toBeChecked();
});
