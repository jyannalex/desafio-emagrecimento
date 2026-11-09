import { act, renderHook, screen, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../components/Toast';
import * as repo from '../data/repo';
import type { DailyLog } from '../types';
import { useDailyLog } from './useDailyLog';

vi.mock('../data/repo');

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeEach(() => {
  vi.mocked(repo.getLogs).mockResolvedValue([]);
  vi.mocked(repo.upsertLog).mockReset();
  vi.mocked(repo.upsertLog).mockImplementation(async (l: DailyLog) => {
    await tick();
    return l;
  });
});

async function setup(editable = true) {
  const r = renderHook(() => useDailyLog('u1', '2026-11-09', 2000, editable), { wrapper });
  await waitFor(() => expect(r.result.current.loading).toBe(false));
  return r;
}

test('3 toques rápidos de +250 resultam em 750 gravado', async () => {
  const { result } = await setup();
  act(() => {
    result.current.addAgua(250);
    result.current.addAgua(250);
    result.current.addAgua(250);
  });
  expect(result.current.log.agua_ml).toBe(750);
  await waitFor(() => {
    const calls = vi.mocked(repo.upsertLog).mock.calls;
    expect(calls.at(-1)?.[0].agua_ml).toBe(750);
  });
  await act(tick);
  expect(vi.mocked(repo.upsertLog).mock.calls.at(-1)?.[0].agua_ml).toBe(750);
});

test('primeiro toque −250 cria log com agua_ml 0 e meta atual', async () => {
  const { result } = await setup();
  act(() => result.current.addAgua(-250));
  await waitFor(() => expect(repo.upsertLog).toHaveBeenCalled());
  expect(vi.mocked(repo.upsertLog).mock.calls[0][0]).toMatchObject({
    user_id: 'u1',
    dia: '2026-11-09',
    agua_ml: 0,
    meta_agua_ml_do_dia: 2000,
  });
});

test('log existente mantém a própria meta do dia', async () => {
  vi.mocked(repo.getLogs).mockResolvedValue([
    { user_id: 'u1', dia: '2026-11-09', cafe: true, almoco: false, lanche: false, jantar: false, nota_cafe: null, nota_almoco: null, nota_lanche: null, nota_jantar: null, atividade: false, atividade_min: 0, agua_ml: 500, meta_agua_ml_do_dia: 3000 },
    { user_id: 'outro', dia: '2026-11-09', cafe: false, almoco: true, lanche: false, jantar: false, nota_cafe: null, nota_almoco: null, nota_lanche: null, nota_jantar: null, atividade: false, atividade_min: 0, agua_ml: 0, meta_agua_ml_do_dia: 2000 },
  ]);
  const { result } = await setup();
  expect(result.current.log.cafe).toBe(true);
  expect(result.current.log.almoco).toBe(false);
  expect(result.current.log.meta_agua_ml_do_dia).toBe(3000);
});

test('erro reverte e mostra toast', async () => {
  vi.mocked(repo.upsertLog).mockRejectedValue(new Error('offline'));
  const Probe = () => {
    const h = useDailyLog('u1', '2026-11-09', 2000, true);
    return (
      <button onClick={() => h.update({ cafe: true })} disabled={h.loading}>
        cafe:{String(h.log.cafe)}
      </button>
    );
  };
  render(<Probe />, { wrapper });
  const btn = await screen.findByRole('button', { name: 'cafe:false' });
  await waitFor(() => expect(btn).not.toBeDisabled());
  act(() => btn.click());
  expect(await screen.findByText('Não salvou, tente de novo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'cafe:false' })).toBeInTheDocument();
});

test('dia não editável ignora update', async () => {
  const { result } = await setup(false);
  act(() => {
    result.current.update({ cafe: true });
    result.current.addAgua(250);
  });
  await act(tick);
  expect(repo.upsertLog).not.toHaveBeenCalled();
  expect(result.current.log.cafe).toBe(false);
});

test('somar minutos de atividade marca o ponto ao chegar em 60', async () => {
  const { result } = await setup();
  act(() => {
    result.current.addAtividade(10);
    result.current.addAtividade(30);
  });
  expect(result.current.log.atividade_min).toBe(40);
  expect(result.current.log.atividade).toBe(false);
  act(() => result.current.addAtividade(30));
  expect(result.current.log.atividade_min).toBe(70);
  expect(result.current.log.atividade).toBe(true);
  act(() => result.current.addAtividade(-10));
  act(() => result.current.addAtividade(-10));
  expect(result.current.log.atividade).toBe(false);
  await waitFor(() => expect(vi.mocked(repo.upsertLog).mock.calls.at(-1)?.[0]).toMatchObject({ atividade_min: 50, atividade: false }));
});

test('minutos de atividade nunca ficam negativos', async () => {
  const { result } = await setup();
  act(() => result.current.addAtividade(-10));
  expect(result.current.log.atividade_min).toBe(0);
});
