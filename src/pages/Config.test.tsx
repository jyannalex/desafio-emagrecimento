import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as auth from '../data/auth';
import { AppCtx } from '../data/AppContext';
import * as repo from '../data/repo';
import type { Challenge } from '../types';
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
});

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
    expect(repo.saveChallenge).toHaveBeenCalledWith({ nome: 'Verão', data_inicio: '2026-11-10', data_fim: '2027-02-07' }),
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
