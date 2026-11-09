import { useEffect, useState } from 'react';
import { todayBR } from '../lib/dates';

/** "Hoje" em São Paulo, recalculado quando o app volta ao primeiro plano e a cada minuto. */
export function useToday(): string {
  const [today, setToday] = useState(todayBR);
  useEffect(() => {
    const tick = () => setToday(todayBR());
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    const id = setInterval(tick, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
      clearInterval(id);
    };
  }, []);
  return today;
}
