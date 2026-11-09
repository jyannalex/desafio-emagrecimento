import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../data/AppContext';
import { getProfiles } from '../data/repo';
import { useDailyLog } from '../hooks/useDailyLog';
import { useToday } from '../hooks/useToday';
import { addDays, formatBR, formatLong, isEditable } from '../lib/dates';
import { playerSlot, playerSoftVar, playerVar } from '../lib/players';
import { ATIVIDADE_META_MIN, dayPoints, MAX_POINTS } from '../lib/scoring';
import type { Challenge } from '../types';

type MealKey = 'cafe' | 'almoco' | 'lanche' | 'jantar';
type NoteKey = 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar';

const MEALS: { key: MealKey; note: NoteKey; label: string; noteLabel: string }[] = [
  { key: 'cafe', note: 'nota_cafe', label: 'Café da manhã', noteLabel: 'O que comeu no café da manhã' },
  { key: 'almoco', note: 'nota_almoco', label: 'Almoço', noteLabel: 'O que comeu no almoço' },
  { key: 'lanche', note: 'nota_lanche', label: 'Lanche', noteLabel: 'O que comeu no lanche' },
  { key: 'jantar', note: 'nota_jantar', label: 'Jantar', noteLabel: 'O que comeu no jantar' },
];

export default function Hoje() {
  const { userId, challenge } = useApp();
  const today = useToday();
  const [qual, setQual] = useState<'hoje' | 'ontem'>('hoje');
  const [perfil, setPerfil] = useState<{ meta: number; slot: 1 | 2 } | null>(null);
  const [erro, setErro] = useState(false);

  async function carregarPerfil() {
    setErro(false);
    try {
      const ps = await getProfiles();
      setPerfil({ meta: ps.find((p) => p.id === userId)?.meta_agua_ml ?? 2000, slot: playerSlot(ps, userId) });
    } catch {
      setErro(true);
    }
  }

  useEffect(() => {
    carregarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const dia = qual === 'hoje' ? today : addDays(today, -1);
  const cor = perfil ? ({ '--me': playerVar(perfil.slot), '--me-soft': playerSoftVar(perfil.slot) } as CSSProperties) : undefined;

  return (
    <main className="page" style={cor}>
      <div className="seg" role="group" aria-label="Qual dia">
        <button aria-pressed={qual === 'hoje'} onClick={() => setQual('hoje')}>
          Hoje
        </button>
        <button aria-pressed={qual === 'ontem'} onClick={() => setQual('ontem')}>
          Ontem
        </button>
      </div>
      {erro && (
        <div className="notice danger">
          Não foi possível carregar seu perfil.{' '}
          <button className="btn" onClick={carregarPerfil}>
            Tentar de novo
          </button>
        </div>
      )}
      {perfil && challenge && <Dia key={dia} userId={userId} dia={dia} today={today} meta={perfil.meta} challenge={challenge} />}
    </main>
  );
}

function motivoTrava(dia: string, today: string, ch: Challenge): string {
  if (today < ch.data_inicio) return `O desafio começa em ${formatBR(ch.data_inicio)}`;
  if (dia < ch.data_inicio || dia > ch.data_fim) return 'Fora do período do desafio';
  return 'Esse dia já fechou';
}

function Ring({ pts }: { pts: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const gap = 17;
  const seg = c / MAX_POINTS - gap;
  return (
    <div className="ring" role="img" aria-label={`${pts} de ${MAX_POINTS} pontos`}>
      <svg viewBox="0 0 112 112" aria-hidden>
        {Array.from({ length: MAX_POINTS }, (_, i) => (
          <circle
            key={i}
            className={`seg-arc${i < pts ? ' on' : ''}`}
            cx="56"
            cy="56"
            r={r}
            strokeDasharray={`${seg} ${c - seg}`}
            strokeDashoffset={-(i * (c / MAX_POINTS) + gap / 2)}
          />
        ))}
      </svg>
      <div className="center" aria-hidden>
        <div>
          <div className="display pts num">{pts}</div>
          <div className="of">de {MAX_POINTS}</div>
        </div>
      </div>
    </div>
  );
}

function resumo(pts: number) {
  if (pts === MAX_POINTS) return 'Dia completo. Todas as tarefas feitas!';
  const falta = MAX_POINTS - pts;
  return falta === 1 ? 'Falta 1 tarefa para fechar o dia.' : `Faltam ${falta} tarefas para fechar o dia.`;
}

function Dia({ userId, dia, today, meta, challenge }: { userId: string; dia: string; today: string; meta: number; challenge: Challenge }) {
  const editable = isEditable(dia, today, challenge);
  const { log, loading, loadError, reload, update, addAgua, addAtividade } = useDailyLog(userId, dia, meta, editable);
  const off = !editable || loading || loadError;
  const pts = dayPoints(log);
  const refeicoes = MEALS.filter((m) => log[m.key]).length;
  const pctAgua = Math.min(100, Math.round((log.agua_ml / log.meta_agua_ml_do_dia) * 100));
  const aguaOk = log.agua_ml >= log.meta_agua_ml_do_dia;
  const pctAtividade = Math.min(100, Math.round((log.atividade_min / ATIVIDADE_META_MIN) * 100));
  const atividadeOk = log.atividade_min >= ATIVIDADE_META_MIN;

  return (
    <>
      <header className="day-head">
        <div className="grow">
          <h1>{dia === today ? 'Hoje' : 'Ontem'}</h1>
          <div className="date">{formatLong(dia)}</div>
          {editable && !loading && <p className="muted small" style={{ margin: '8px 0 0' }}>{resumo(pts)}</p>}
        </div>
        <Ring pts={pts} />
      </header>

      {!editable && <div className="notice">{motivoTrava(dia, today, challenge)}</div>}
      {loadError && (
        <div className="notice danger">
          Não foi possível carregar o dia.{' '}
          <button className="btn" onClick={reload}>
            Tentar de novo
          </button>
        </div>
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>Refeições</h2>
          <span className="muted small">{refeicoes} de 4 na dieta</span>
        </div>
        <ul className="tasks">
          {MEALS.map((m) => (
            <li className="task" key={m.key}>
              <label className="task-main">
                <input
                  className="check"
                  type="checkbox"
                  aria-label={m.label}
                  checked={log[m.key]}
                  disabled={off}
                  onChange={(e) => update({ [m.key]: e.target.checked })}
                />
                <span className="task-name">{m.label}</span>
              </label>
              <div className="task-sub">
                <Nota label={m.noteLabel} value={log[m.note]} disabled={off} onSave={(v) => update({ [m.note]: v })} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Atividade física</h2>
          <span className="muted small">{atividadeOk ? 'Meta batida' : `Meta de ${ATIVIDADE_META_MIN} min`}</span>
        </div>
        <div className={`meter activity${pctAtividade >= 55 ? ' done' : ''}`}>
          <div className="fill" style={{ width: `${pctAtividade}%` }} />
          <div className="label">
            {log.atividade_min} / {ATIVIDADE_META_MIN} min
          </div>
        </div>
        <div className="meter-btns four">
          <button className="btn" disabled={off || log.atividade_min === 0} onClick={() => addAtividade(-10)} aria-label="−10 min">
            −10
          </button>
          <button className="btn add" disabled={off} onClick={() => addAtividade(10)} aria-label="+10 min">
            +10 min
          </button>
          <button className="btn add" disabled={off} onClick={() => addAtividade(30)} aria-label="+30 min">
            +30 min
          </button>
          <button className="btn add" disabled={off} onClick={() => addAtividade(60)} aria-label="+1 h">
            +1 h
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>Água</h2>
          <span className="muted small">{aguaOk ? 'Meta batida' : `Meta de ${log.meta_agua_ml_do_dia} ml`}</span>
        </div>
        <div className={`meter water${pctAgua >= 55 ? ' done' : ''}`}>
          <div className="fill" style={{ width: `${pctAgua}%` }} />
          <div className="label">
            {log.agua_ml} / {log.meta_agua_ml_do_dia} ml
          </div>
        </div>
        <div className="meter-btns">
          <button className="btn" disabled={off || log.agua_ml === 0} onClick={() => addAgua(-250)} aria-label="−250 ml">
            −250
          </button>
          <button className="btn add" disabled={off} onClick={() => addAgua(250)} aria-label="+250 ml">
            +250 ml
          </button>
          <button className="btn add" disabled={off} onClick={() => addAgua(500)} aria-label="+500 ml">
            +500 ml
          </button>
        </div>
      </section>
    </>
  );
}

function useSynced<T>(external: T) {
  const [v, setV] = useState(external);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setV(external);
  }, [external]);
  return { v, setV, focused };
}

function Nota({ label, value, disabled, onSave }: { label: string; value: string | null; disabled: boolean; onSave: (v: string | null) => void }) {
  const { v, setV, focused } = useSynced(value ?? '');
  return (
    <input
      className="note"
      type="text"
      aria-label={label}
      placeholder="Anotar o que comeu"
      value={v}
      disabled={disabled}
      maxLength={500}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        focused.current = false;
        const novo = v.trim() || null;
        if (novo !== (value ?? null)) onSave(novo);
      }}
    />
  );
}
