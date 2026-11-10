import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as repo from '../data/repo';
import type { VarLance } from '../types';
import { ToastProvider } from './Toast';
import { AbrirVar, LanceVar, SeloVar } from './Var';

vi.mock('../data/repo');

const lance = (over: Partial<VarLance> = {}): VarLance => ({
  id: 1,
  alvo: 'b',
  autor: 'a',
  dia: '2026-11-08',
  ponto: 'almoco',
  motivo: 'almoço na dieta com coxinha?',
  status: 'aberto',
  created_at: 't',
  ...over,
});
const nomes = { a: 'Jyann', b: 'Mari' };

beforeEach(() => {
  vi.mocked(repo.getMensagens).mockResolvedValue([{ id: 5, lance_id: 1, autor: 'b', texto: 'era coxinha de forno', created_at: 't' }]);
  vi.mocked(repo.enviarMensagem).mockImplementation(async (m) => ({ ...m, id: 6, created_at: 't' }));
  vi.mocked(repo.decidirLance).mockImplementation(async (id, status) => lance({ id, status }));
});

const renderLance = (l: VarLance, meuId: string, onMudou = vi.fn()) =>
  render(
    <ToastProvider>
      <LanceVar lance={l} meuId={meuId} nomes={nomes} onMudou={onMudou} onFechar={() => {}} />
    </ToastProvider>,
  );

test('abrir VAR pede motivo de pelo menos 3 letras', async () => {
  const onAbrir = vi.fn(async () => {});
  render(<AbrirVar alvo="almoço de Mari · 8 de novembro" onAbrir={onAbrir} onFechar={() => {}} />);
  const dlg = screen.getByRole('dialog', { name: 'Chamar o VAR' });
  expect(within(dlg).getByText('almoço de Mari · 8 de novembro')).toBeInTheDocument();
  const botao = within(dlg).getByRole('button', { name: 'Abrir VAR' });
  await userEvent.type(within(dlg).getByLabelText('Motivo'), 'oi');
  expect(botao).toBeDisabled();
  await userEvent.type(within(dlg).getByLabelText('Motivo'), ' comeu coxinha');
  await userEvent.click(botao);
  expect(onAbrir).toHaveBeenCalledWith('oi comeu coxinha');
});

test('contestado vê o motivo e a conversa, pode aceitar mas não retirar', async () => {
  const onMudou = vi.fn();
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
  renderLance(lance(), 'b', onMudou);
  const dlg = screen.getByRole('dialog', { name: 'VAR: almoço de Mari' });
  expect(within(dlg).getByText('almoço na dieta com coxinha?')).toBeInTheDocument();
  expect(await within(dlg).findByText('era coxinha de forno')).toBeInTheDocument();
  expect(within(dlg).getByText(/Em análise/)).toBeInTheDocument();
  expect(within(dlg).queryByRole('button', { name: 'Retirar contestação' })).not.toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Aceitar e perder o ponto' }));
  expect(confirmar).toHaveBeenCalled();
  expect(repo.decidirLance).toHaveBeenCalledWith(1, 'aceito');
  await waitFor(() => expect(onMudou).toHaveBeenCalledWith(expect.objectContaining({ status: 'aceito' })));
  confirmar.mockRestore();
});

test('quem abriu pode retirar, não aceitar', async () => {
  renderLance(lance(), 'a');
  const dlg = screen.getByRole('dialog', { name: 'VAR: almoço de Mari' });
  expect(within(dlg).queryByRole('button', { name: 'Aceitar e perder o ponto' })).not.toBeInTheDocument();
  await userEvent.click(within(dlg).getByRole('button', { name: 'Retirar contestação' }));
  expect(repo.decidirLance).toHaveBeenCalledWith(1, 'retirado');
});

test('os dois escrevem na conversa', async () => {
  renderLance(lance(), 'b');
  const dlg = screen.getByRole('dialog', { name: 'VAR: almoço de Mari' });
  await userEvent.type(within(dlg).getByLabelText('Escrever'), 'tenho foto!');
  await userEvent.click(within(dlg).getByRole('button', { name: 'Enviar' }));
  expect(repo.enviarMensagem).toHaveBeenCalledWith({ lance_id: 1, autor: 'b', texto: 'tenho foto!' });
  expect(await within(dlg).findByText('tenho foto!')).toBeInTheDocument();
  expect(within(dlg).getByLabelText('Escrever')).toHaveValue('');
});

test('lance encerrado mostra o resultado e não tem ações', async () => {
  renderLance(lance({ status: 'aceito' }), 'b');
  const dlg = screen.getByRole('dialog', { name: 'VAR: almoço de Mari' });
  expect(within(dlg).getByText('Ponto anulado: Mari aceitou.')).toBeInTheDocument();
  expect(within(dlg).queryByLabelText('Escrever')).not.toBeInTheDocument();
  expect(within(dlg).queryByRole('button', { name: /Aceitar|Retirar/ })).not.toBeInTheDocument();
});

test('falha ao decidir avisa', async () => {
  vi.mocked(repo.decidirLance).mockRejectedValue(new Error('Esse lance já foi decidido'));
  renderLance(lance(), 'a');
  await userEvent.click(screen.getByRole('button', { name: 'Retirar contestação' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Esse lance já foi decidido');
});

test('selo mostra em análise ou anulado e abre o lance', async () => {
  const abrir = vi.fn();
  const { rerender } = render(<SeloVar lance={lance()} onAbrir={abrir} />);
  await userEvent.click(screen.getByRole('button', { name: 'Ver lance do VAR: em análise' }));
  expect(abrir).toHaveBeenCalled();
  rerender(<SeloVar lance={lance({ status: 'aceito' })} onAbrir={abrir} />);
  expect(screen.getByRole('button', { name: 'Ver lance do VAR: anulado pelo VAR' })).toBeInTheDocument();
  rerender(<SeloVar lance={lance({ status: 'retirado' })} onAbrir={abrir} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
