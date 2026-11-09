import { act, renderHook } from '@testing-library/react';
import * as dates from '../lib/dates';
import { useToday } from './useToday';

vi.mock('../lib/dates', async (orig) => ({ ...(await orig<typeof import('../lib/dates')>()), todayBR: vi.fn() }));

test('atualiza o dia quando o app volta ao primeiro plano depois da meia-noite', () => {
  vi.mocked(dates.todayBR).mockReturnValue('2026-11-09');
  const { result } = renderHook(() => useToday());
  expect(result.current).toBe('2026-11-09');
  vi.mocked(dates.todayBR).mockReturnValue('2026-11-10');
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(result.current).toBe('2026-11-10');
});

test('atualiza o dia com o app aberto (a cada minuto)', () => {
  vi.useFakeTimers();
  try {
    vi.mocked(dates.todayBR).mockReturnValue('2026-11-09');
    const { result } = renderHook(() => useToday());
    vi.mocked(dates.todayBR).mockReturnValue('2026-11-10');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe('2026-11-10');
  } finally {
    vi.useRealTimers();
  }
});
