import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { getLogs, upsertLog } from '../data/repo';
import type { DailyLog } from '../types';
import { ATIVIDADE_META_MIN } from '../lib/scoring';

export function emptyLog(userId: string, dia: string, meta: number): DailyLog {
  return {
    user_id: userId,
    dia,
    cafe: false,
    almoco: false,
    lanche: false,
    jantar: false,
    nota_cafe: null,
    nota_almoco: null,
    nota_lanche: null,
    nota_jantar: null,
    nota_atividade: null,
    atividade: false,
    atividade_min: 0,
    agua_ml: 0,
    meta_agua_ml_do_dia: meta,
  };
}

/**
 * Registro do dia com gravação otimista.
 * Cada alteração aparece na hora; as gravações vão numa fila serial que sempre
 * envia o estado mais recente. Em erro, volta ao último estado confirmado.
 */
export function useDailyLog(userId: string, dia: string, metaAtual: number, editable: boolean) {
  const toast = useToast();
  const [log, setLog] = useState<DailyLog>(() => emptyLog(userId, dia, metaAtual));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const current = useRef(log);
  const confirmed = useRef(log);
  const saving = useRef(false);

  const apply = (next: DailyLog) => {
    current.current = next;
    setLog(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const rows = await getLogs(dia, dia);
      const found = rows.find((r) => r.user_id === userId) ?? emptyLog(userId, dia, metaAtual);
      confirmed.current = found;
      apply(found);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // a meta só vale para registros novos; não recarregar se ela mudar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dia]);

  useEffect(() => {
    load();
  }, [load]);

  const flush = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    let sent: DailyLog | null = null;
    while (current.current !== sent) {
      sent = current.current;
      try {
        confirmed.current = await upsertLog(sent);
      } catch {
        apply(confirmed.current);
        toast('Não salvou, tente de novo');
        break;
      }
    }
    saving.current = false;
  }, [toast]);

  const update = useCallback(
    (patch: Partial<DailyLog>) => {
      if (!editable || loading || loadError) return;
      apply({ ...current.current, ...patch, user_id: userId, dia });
      flush();
    },
    [editable, loading, loadError, userId, dia, flush],
  );

  const addAgua = useCallback(
    (delta: number) => update({ agua_ml: Math.max(0, current.current.agua_ml + delta) }),
    [update],
  );

  const addAtividade = useCallback(
    (delta: number) => {
      const min = Math.max(0, current.current.atividade_min + delta);
      update({ atividade_min: min, atividade: min >= ATIVIDADE_META_MIN });
    },
    [update],
  );

  return { log, loading, loadError, reload: load, editable, update, addAgua, addAtividade };
}
