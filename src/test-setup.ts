import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// recharts usa ResizeObserver, que o jsdom não tem
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver ??= RO;

afterEach(() => {
  vi.clearAllMocks();
});
