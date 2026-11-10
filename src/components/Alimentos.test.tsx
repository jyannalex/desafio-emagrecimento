import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../data/repo';
import { useItensDia } from '../hooks/useItensDia';
import type { Food, MealItem } from '../types';
import { ItensRefeicao } from './Alimentos';
import { ToastProvider } from './Toast';

vi.mock('../data/repo');

const DIA = '2026-11-10';
const f = (id: number, nome: string, kcal_100g: number): Food => ({ id, nome, kcal_100g, kcal_unidade: null, origem: 'taco', criado_por: null });
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
  unidades: null,
  kcal_unidade: null,
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
      onAdicionar={(food, q) => d.adicionar('almoco', food, q)}
      onMudar={d.mudarQuantidade}
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

let nextId = 77;
beforeEach(() => {
  vi.mocked(repo.getFoods).mockResolvedValue(CATALOGO);
  vi.mocked(repo.getMealItems).mockResolvedValue([]);
  vi.mocked(repo.recentFoods).mockResolvedValue([]);
  vi.mocked(repo.addMealItem).mockImplementation(async (i) => ({ ...i, id: nextId++ }));
  vi.mocked(repo.updateMealItemQuantidade).mockImplementation(async (id, q) => item({ id, ...q }));
  vi.mocked(repo.deleteMealItem).mockResolvedValue();
  vi.mocked(repo.createFood).mockImplementation(async (x) => ({ ...x, id: 50, origem: 'custom' }));
});

async function abrirBusca() {
  const add = await screen.findByRole('button', { name: 'Adicionar alimento no almoço' });
  await waitFor(() => expect(add).not.toBeDisabled());
  await userEvent.click(add);
  return screen.getByRole('dialog', { name: 'Adicionar ao almoço' });
}

async function escolher(dlg: HTMLElement, termo: string, nome: RegExp) {
  const busca = within(dlg).getByLabelText('Buscar alimento');
  await userEvent.clear(busca);
  await userEvent.type(busca, termo);
  await userEvent.click(await within(dlg).findByRole('button', { name: nome }));
}

test('escolhe na lista, digita gramas ali mesmo e adiciona; a busca fica aberta até concluir', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await escolher(dlg, 'arroz', /Arroz branco cozido/);
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
    unidades: null,
    kcal_unidade: null,
  });
  // continua aberta, busca limpa, rodapé com o que entrou
  expect(within(dlg).getByLabelText('Buscar alimento')).toHaveValue('');
  expect(within(dlg).queryByLabelText('Gramas')).not.toBeInTheDocument();
  expect(await within(dlg).findByText('1 item · 154 kcal')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Concluir' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Arroz branco cozido, 120 g, 154 kcal' })).toBeInTheDocument();
});

test('lança vários alimentos sem fechar', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await escolher(dlg, 'arroz', /Arroz branco cozido/);
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  await escolher(dlg, 'feijao', /Feijão carioca cozido/);
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '140');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(await within(dlg).findByText('2 itens · 260 kcal')).toBeInTheDocument();
  expect(repo.addMealItem).toHaveBeenCalledTimes(2);
});

test('atalhos de quantidade e botões menos e mais', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await escolher(dlg, 'arroz', /Arroz branco cozido/);
  await userEvent.click(within(dlg).getByRole('button', { name: '150 g' }));
  expect(within(dlg).getByLabelText('Gramas')).toHaveValue('150');
  expect(within(dlg).getByText('= 192 kcal')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Mais 10 g' }));
  expect(within(dlg).getByLabelText('Gramas')).toHaveValue('160');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Menos 10 g' }));
  await userEvent.click(within(dlg).getByRole('button', { name: 'Menos 10 g' }));
  expect(within(dlg).getByLabelText('Gramas')).toHaveValue('140');
});

test('sem texto mostra Repetir com a última quantidade e lança com um toque', async () => {
  vi.mocked(repo.recentFoods).mockResolvedValue([{ food_id: 2, qtd: 140 }]);
  renderAlmoco();
  const dlg = await abrirBusca();
  expect(await within(dlg).findByText('Repetir')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Repetir Feijão carioca cozido, 140 g' }));
  expect(repo.addMealItem).toHaveBeenCalledWith(expect.objectContaining({ food_id: 2, gramas: 140 }));
  expect(await within(dlg).findByText('1 item · 106 kcal')).toBeInTheDocument();
});

test('aceita vírgula nas gramas e trava o 0', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await escolher(dlg, 'arroz', /Arroz branco cozido/);
  const g = within(dlg).getByLabelText('Gramas');
  await userEvent.type(g, '0');
  expect(within(dlg).getByRole('button', { name: 'Adicionar' })).toBeDisabled();
  await userEvent.clear(g);
  await userEvent.type(g, '120,5');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(repo.addMealItem).toHaveBeenCalledWith(expect.objectContaining({ gramas: 120.5 }));
});

test('busca sem resultado já mostra o cadastro e depois abre a quantidade do novo alimento', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'marmita da tia');
  expect(within(dlg).getByText('Nenhum alimento com esse nome. Cadastre aqui:')).toBeInTheDocument();
  expect(within(dlg).getByLabelText('Nome')).toHaveValue('Marmita da tia');
  await userEvent.type(within(dlg).getByLabelText('Calorias (kcal)'), '120');
  await userEvent.clear(within(dlg).getByLabelText('Em quantos gramas'));
  await userEvent.type(within(dlg).getByLabelText('Em quantos gramas'), '30');
  expect(within(dlg).getByText('= 400 kcal em 100 g')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alimento' }));
  expect(repo.createFood).toHaveBeenCalledWith({ nome: 'Marmita da tia', kcal_100g: 400, kcal_unidade: null, criado_por: 'u1' });
  await userEvent.type(await within(dlg).findByLabelText('Gramas'), '200');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(repo.addMealItem).toHaveBeenCalledWith(expect.objectContaining({ food_id: 50, nome: 'Marmita da tia', gramas: 200 }));
});

test('com resultados, o atalho de cadastrar fica antes da lista', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'arroz');
  const atalho = within(dlg).getByRole('button', { name: 'Não achou? Cadastrar "arroz"' });
  const primeiro = within(dlg).getByRole('button', { name: /Arroz branco cozido/ });
  expect(atalho.compareDocumentPosition(primeiro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await userEvent.click(atalho);
  expect(within(dlg).getByLabelText('Nome')).toHaveValue('Arroz');
});

test('cadastra por unidade e lança em unidades pelo atalho', async () => {
  renderAlmoco();
  const dlg = await abrirBusca();
  await userEvent.type(within(dlg).getByLabelText('Buscar alimento'), 'coxinha');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Por unidade' }));
  expect(within(dlg).queryByLabelText('Em quantos gramas')).not.toBeInTheDocument();
  await userEvent.type(within(dlg).getByLabelText('Calorias de 1 unidade (kcal)'), '250');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar alimento' }));
  expect(repo.createFood).toHaveBeenCalledWith({ nome: 'Coxinha', kcal_100g: null, kcal_unidade: 250, criado_por: 'u1' });
  await within(dlg).findByLabelText('Unidades');
  await userEvent.click(within(dlg).getByRole('button', { name: '2 un' }));
  expect(within(dlg).getByText('= 500 kcal')).toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Mais 0,5 un' }));
  expect(within(dlg).getByLabelText('Unidades')).toHaveValue('2,5');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(repo.addMealItem).toHaveBeenCalledWith(
    expect.objectContaining({ food_id: 50, nome: 'Coxinha', kcal_100g: null, gramas: null, unidades: 2.5, kcal_unidade: 250 }),
  );
  await userEvent.click(within(dlg).getByRole('button', { name: 'Concluir' }));
  expect(await screen.findByRole('button', { name: 'Coxinha, 2,5 un, 625 kcal' })).toBeInTheDocument();
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
  expect(repo.updateMealItemQuantidade).toHaveBeenCalledWith(9, { gramas: 150 });
  await userEvent.click(await screen.findByRole('button', { name: 'Arroz branco cozido, 150 g, 192 kcal' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }));
  expect(repo.deleteMealItem).toHaveBeenCalledWith(9);
  await waitFor(() => expect(screen.queryByRole('button', { name: /Arroz branco cozido,/ })).not.toBeInTheDocument());
});

test('editar item por unidade muda as unidades', async () => {
  vi.mocked(repo.getMealItems).mockResolvedValue([item({ nome: 'Coxinha', kcal_100g: null, gramas: null, unidades: 2, kcal_unidade: 250 })]);
  renderAlmoco();
  await userEvent.click(await screen.findByRole('button', { name: 'Coxinha, 2 un, 500 kcal' }));
  const dlg = screen.getByRole('dialog', { name: 'Coxinha' });
  const qtd = within(dlg).getByLabelText('Unidades');
  expect(qtd).toHaveValue('2');
  await userEvent.clear(qtd);
  await userEvent.type(qtd, '3');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Salvar' }));
  expect(repo.updateMealItemQuantidade).toHaveBeenCalledWith(9, { unidades: 3 });
  expect(await screen.findByRole('button', { name: 'Coxinha, 3 un, 750 kcal' })).toBeInTheDocument();
});

test('se não salvar, o item não entra e avisa', async () => {
  vi.mocked(repo.addMealItem).mockRejectedValue(new Error('rede'));
  renderAlmoco();
  const dlg = await abrirBusca();
  await escolher(dlg, 'arroz', /Arroz branco cozido/);
  await userEvent.type(within(dlg).getByLabelText('Gramas'), '120');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Adicionar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi salvo, tente de novo');
  expect(within(dlg).queryByText(/item ·/)).not.toBeInTheDocument();
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
