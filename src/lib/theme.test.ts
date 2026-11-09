import { getThemePref, setThemePref } from './theme';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test('padrão é automático', () => {
  expect(getThemePref()).toBe('auto');
});

test('escolher escuro grava e aplica no html', () => {
  setThemePref('dark');
  expect(getThemePref()).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
});

test('voltar para automático remove o tema forçado', () => {
  setThemePref('light');
  setThemePref('auto');
  expect(getThemePref()).toBe('auto');
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

test('localStorage bloqueado não quebra', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  try {
    expect(getThemePref()).toBe('auto');
  } finally {
    spy.mockRestore();
  }
});
