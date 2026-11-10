import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../data/repo';
import { useItensDia } from '../hooks/useItensDia';
import type { Food, MealItem } from '../types';
import { ItensRefeicao } from './Alimentos';
import { ToastProvider } from './Toast';

vi.mock('../data/repo');

const DIA = '2026-11-10';
const f = (id: number, nome: string, kcal_100g: number): Food => ({ id, nome, kcal_100g, origem: 'taco', criado_por: null });
const CATALOGO = [f(1, 'Arroz branco cozido', 128), f(2, 'Feijão carioca cozido', 76)];
const item = (over: Partial<MealItem> = {}): MealItem => ({
  id: 9,
  user_id: 'u1',
  dia: DIA,
  refeicao: 'almoco',
  food_id: 1,
  nome: 'Arroz branco cozido',
  kcal_100g: 128,
  gramas: 120,
  ...over,
});

function Almoco({ podeEditar = true }: { podeEditar?: boolean }) {
  const d = useItensDia('u1', DIA);
  return (
    <ItensRefeicao
      userId="u1"
      rotulo="almoço"
      itens={d.itens.filter((i) => i.refeicao === 'almoco')}
      podeEditar={podeEditar && d.carregado}
      onAdicionar={(food, g) => d.adicionar('almoco', food, g)}
      onMudar={d.mudarGramas}
      onRemover={d.remover}
    />
  );
}

const renderAlmoco = (podeEditar = true) =>
  render(
    <ToastProvider>
      <Almoco podeEditar={podeEditar} />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.mocked(repo.getFoods).mockResolvedValue(CATALOGO);
  vi.mocked(repo.getMealItems).mockResolvedValue([]);
  vi.mocked(repo.recentFoodIds).mockResolvedValue([]);
  vi.mocked(repo.addMealItem).mockImplementation(async (i) => ({ ...i, id: 77 }));
  vi.mocked(repo.updateMealItemGramas).mockImplementation(async (id, gramas) => item({ id, gramas }));
  vi.mocked(repo.deleteMealItem).mockResolvedValue();
  vi.mocked(repo.createFood).mockImplementation(async (x) => ({ ...x, id: 50, origem: 'custom' }));
});

async function abrirBusca() {
  const add = await screen.findByRole('button', { name: 'Adicionar alimento no almoço' });
  await waitFor(() => expect(add).not.toBeDisabled());
  await userEvent.click(add);
  return screen.getByRole('dialog', { name: 'Adicionar alimento' });
}

test('busca, escolhe, digita gramas e adiciona', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(within(dlg).getByRole('button', { name: /Arroz branco cozido/ }));
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  expect(within(dlg).getByText('= 154 kcal')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(repo.addMealItem).toHaveBeenCalledWith({
    user_id: 'u1',
    dia: DIA,
    refeicao: 'almoco',
    food_id: 1,
    nome: 'Arroz branco cozido',
    kcal_100g: 128,
    gramas: 120,
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Arroz branco cozido, 120 g, 154 kcal' })).toBeInTheDocument();
});

test('sem texto mostra os usados recentemente', async () => {
  vi.mocked(repo.recentFoodIds).mockResolvedValue([2]);
  renderAlmoco();
  const dlg = await abrirBusca();
  expect(await within(dlg).findByText('Usados recentemente')).toBeInTheDocument();
  expect(within(dlg).getByRole('button', { name: /Feijão carioca cozido/ })).toBeInTheDocument();
  expect(within(dlg).queryByRole('button', { name: /Arroz branco/ })).not.toBeInTheDocument();
});

test('aceita vírgula nas gramas e trava o 0', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(within(dlg).getByRole('button', { name: /Arroz branco cozido/ }));
  const g = within(dlg).getByLabelText('Gramas');
  await userEvent.type(g, '0');
  expect(within(dlg).getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  await userEvent.clear(g);
  await userEvent.type(g, '120,5');
  expect(within(dlg).getByRole('button', { name: 'Adicionar' })).not.toBeDisabled();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(repo.addMealItem).toHaveBeenCalledWith(expect.objectContaining({ gramas: 120.5 }));
});

test('busca sem resultado leva ao cadastro e volta para as gramas do novo alimento', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'marmita da tia');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Cadastrar "marmita da tia"' }));
  expect(within(dlg).getByLabelText('Nome')).toHaveValue('Marmita da tia');
  await userEvent.type(within(dlg).getByLabelText('Calorias (kcal)'), '120');
  await userEvent.clear(within(dlg).getByLabelText('Em quantos gramas'));
  await userEvent.type(within(dlg).getByLabelText('Em quantos gramas'), '30');
  expect(within(dlg).getByText('= 400 kcal em 100 g')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alimento' }));
  expect(repo.createFood).toHaveBeenCalledWith({ nome: 'Marmita da tia', kcal_100g: 400, criado_por: 'u1' });
  expect(await within(dlg).findByLabelText('Gramas')).toBeInTheDocument();
  expect(within(dlg).getByText('Marmita da tia')).toBeInTheDocument();
});

test('editar gramas de um item e depois remover', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([item()]);
  renderAlmoco();
  await userEvent.click(await screen.findByRole('button', { name: 'Arroz branco cozido, 120 g, 154 kcal' }));
  const dlg = screen.getByRole('dialog', { name: 'Arroz branco cozido' });
  const g = within(dlg).getByLabelText('Gramas');
  expect(g).toHaveValue('120');
  await userEvent.clear(g);
  await userEvent.type(g, '150');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
  expect(repo.updateMealItemGramas).toHaveBeenCalledWith(9, 150);
  await userEvent.click(await screen.findByRole('button', { name: 'Arroz branco cozido, 150 g, 192 kcal' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
  expect(repo.deleteMealItem).toHaveBeenCalledWith(9);
  await waitFor(() => expect(screen.queryByRole('button', { name: /Arroz branco cozido,/ })).not.toBeInTheDocument());
});

test('mostra o subtotal da refeição', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([item(), item({ id: 10, food_id: 2, nome: 'Feijão carioca cozido', kcal_100g: 76, gramas: 140 })]);
  renderAlmoco();
  expect(await screen.findByText('260 kcal')).toBeInTheDocument();
});

test('se não salvar, o item some e avisa', async () => {
  vi.mocked(repo.addMealItem).mockRejectedValue(new Error('rede'));
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  await userEvent.click(within(dlg).getByRole('button', { name: /Arroz branco cozido/ }));
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi salvo, tente de novo');
  expect(screen.queryByRole('button', { name: /Arroz branco cozido,/ })).not.toBeInTheDocument();
});

test('catálogo com erro mostra aviso e tenta de novo', async () => {
  vi.mocked(repo.getFoods).mockRejectedValueOnce(new Error('rede'));
  renderAlmoco();
  const dlg = await abrirBusca();
  expect(await within(dlg).findByText('Não foi possível carregar os alimentos')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Tentar de novo' }));
  await userEvent.type(await within(dlg).findByLabelText('Buscar alimento'), 'feij');
  expect(within(dlg).getByRole('button', { name: /Feijão carioca cozido/ })).toBeInTheDocument();
});

test('dia travado mostra os itens sem botões', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([item()]);
  renderAlmoco(false);
  expect(await screen.findByText('Arroz branco cozido')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Arroz branco cozido/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Adicionar alimento no almoço' })).not.toBeInTheDocument();
});
