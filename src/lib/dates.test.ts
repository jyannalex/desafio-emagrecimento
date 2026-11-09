import { addDays, daysInclusive, formatBR, isEditable, todayBR, weekStart } from './dates';

test('todayBR respeita fuso', () => {
  expect(todayBR(new Date('2026-11-09T02:30:00Z'))).toBe('2026-11-08'); // 23:30 BRT
  expect(todayBR(new Date('2026-11-09T03:00:00Z'))).toBe('2026-11-09');
});

test('addDays atravessa mês/ano', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});

test('weekStart é segunda', () => {
  expect(weekStart('2026-11-08')).toBe('2026-11-02'); // domingo
  expect(weekStart('2026-11-09')).toBe('2026-11-09'); // segunda
});

test('daysInclusive', () => {
  expect(daysInclusive('2026-11-01', '2026-11-01')).toBe(1);
  expect(daysInclusive('2026-11-01', '2026-11-10')).toBe(10);
  expect(daysInclusive('2026-11-10', '2026-11-01')).toBe(0);
});

test('isEditable', () => {
  const ch = { data_inicio: '2026-11-08', data_fim: '2027-02-05' };
  expect(isEditable('2026-11-10', '2026-11-10', ch)).toBe(true);
  expect(isEditable('2026-11-09', '2026-11-10', ch)).toBe(true);
  expect(isEditable('2026-11-08', '2026-11-10', ch)).toBe(false); // anteontem
  expect(isEditable('2026-11-07', '2026-11-08', ch)).toBe(false); // antes do início
  expect(isEditable('2027-02-06', '2027-02-06', ch)).toBe(false); // após o fim
});

test('formatBR', () => {
  expect(formatBR('2026-11-09')).toBe('09/11/2026');
});
