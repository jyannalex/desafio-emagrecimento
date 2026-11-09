import { useEffect, useRef, useState } from 'react';
import { useApp } from '../data/AppContext';
import { getProfiles } from '../data/repo';
import { useDailyLog } from '../hooks/useDailyLog';
import { addDays, formatBR, isEditable } from '../lib/dates';
import { useToday } from '../hooks/useToday';
import { dayPoints, MAX_POINTS } from '../lib/scoring';
import type { Challenge } from '../types';

type MealKey = 'cafe' | 'almoco' | 'lanche' | 'jantar';
type NoteKey = 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar';

const MEALS: { key: MealKey; note: NoteKey; icon: string; label: string; noteLabel: string }[] = [
  { key: 'cafe', note: 'nota_cafe', icon: '☕', label: 'Café da manhã', noteLabel: 'O que comeu no café da manhã' },
  { key: 'almoco', note: 'nota_almoco', icon: '🍽️', label: 'Almoço', noteLabel: 'O que comeu no almoço' },
  { key: 'lanche', note: 'nota_lanche', icon: '🍎', label: 'Lanche', noteLabel: 'O que comeu no lanche' },
  { key: 'jantar', note: 'nota_jantar', icon: '🌙', label: 'Jantar', noteLabel: 'O que comeu no jantar' },
];

export default function Hoje() {
  const { userId, challenge } = useApp();
  const today = useToday();
  const [qual, setQual] = useState<'hoje' | 'ontem'>('hoje');
  const [meta, setMeta] = useState<number | null>(null);
  const [erro, setErro] = useState(false);

  async function carregarMeta() {
    setErro(false);
    try {
      const ps = await getProfiles();
      setMeta(ps.find((p) => p.id === userId)?.meta_agua_ml ?? 2000);
    } catch {
      setErro(true);
    }
  }

  useEffect(() => {
    carregarMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const dia = qual === 'hoje' ? today : addDays(today, -1);

  return (
    <main className="page">
      <div className="seg" style={{ marginBottom: 12 }}>
        <button className={qual === 'hoje' ? 'on' : ''} onClick={() => setQual('hoje')}>
          Hoje
        </button>
        <button className={qual === 'ontem' ? 'on' : ''} onClick={() => setQual('ontem')}>
          Ontem
        </button>
      </div>
      {erro && (
        <div className="card">
          <p className="error">Não foi possível carregar seu perfil.</p>
          <button onClick={carregarMeta}>Tentar de novo</button>
        </div>
      )}
      {meta !== null && challenge && (
        <Dia key={dia} userId={userId} dia={dia} today={today} meta={meta} challenge={challenge} />
      )}
    </main>
  );
}

function motivoTrava(dia: string, today: string, ch: Challenge): string {
  if (today < ch.data_inicio) return `O desafio começa em ${formatBR(ch.data_inicio)}`;
  if (dia < ch.data_inicio || dia > ch.data_fim) return 'Fora do período do desafio';
  return 'Esse dia já fechou';
}

function Dia({ userId, dia, today, meta, challenge }: { userId: string; dia: string; today: string; meta: number; challenge: Challenge }) {
  const editable = isEditable(dia, today, challenge);
  const { log, loading, loadError, reload, update, addAgua } = useDailyLog(userId, dia, meta, editable);
  const off = !editable || loading || loadError;
  const pts = dayPoints(log);
  const pctAgua = Math.min(100, Math.round((log.agua_ml / log.meta_agua_ml_do_dia) * 100));

  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>{dia === today ? 'Hoje' : 'Ontem'}</h1>
          <span className="muted">{formatBR(dia)}</span>
        </div>
        <span className="badge" style={{ fontSize: '1.25rem' }}>
          {pts}/{MAX_POINTS}
        </span>
      </div>

      {!editable && (
        <div className="card">
          <strong>{motivoTrava(dia, today, challenge)}</strong>
        </div>
      )}
      {loadError && (
        <div className="card">
          <p className="error">Não foi possível carregar o dia.</p>
          <button onClick={reload}>Tentar de novo</button>
        </div>
      )}

      {MEALS.map((m) => (
        <div className="card" key={m.key}>
          <label className="row">
            <input type="checkbox" aria-label={m.label} checked={log[m.key]} disabled={off} onChange={(e) => update({ [m.key]: e.target.checked })} />
            <span className="grow">
              {m.icon} <span>{m.label}</span>
            </span>
          </label>
          <Nota label={m.noteLabel} value={log[m.note]} disabled={off} onSave={(v) => update({ [m.note]: v })} />
        </div>
      ))}

      <div className="card">
        <label className="row">
          <input type="checkbox" aria-label="Atividade física" checked={log.atividade} disabled={off} onChange={(e) => update({ atividade: e.target.checked })} />
          <span className="grow">
            🏃 <span>Atividade física</span>
          </span>
        </label>
        <Minutos value={log.atividade_min} disabled={off} onSave={(v) => update({ atividade_min: v })} />
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>💧 <span>Água</span></h2>
          <span>
            {log.agua_ml} / {log.meta_agua_ml_do_dia} ml
          </span>
        </div>
        <div className="bar" style={{ margin: '10px 0' }}>
          <div style={{ width: `${pctAgua}%` }} />
        </div>
        <div className="row">
          <button disabled={off || log.agua_ml === 0} onClick={() => addAgua(-250)} aria-label="−250 ml">
            −250
          </button>
          <button className="grow" disabled={off} onClick={() => addAgua(250)} aria-label="+250 ml">
            +250 ml
          </button>
          <button className="grow" disabled={off} onClick={() => addAgua(500)} aria-label="+500 ml">
            +500 ml
          </button>
        </div>
      </div>
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
      type="text"
      aria-label={label}
      placeholder="O que comeu? (opcional)"
      value={v}
      disabled={disabled}
      maxLength={500}
      style={{ marginTop: 8 }}
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

function Minutos({ value, disabled, onSave }: { value: number; disabled: boolean; onSave: (v: number) => void }) {
  const { v, setV, focused } = useSynced(String(value));
  return (
    <label className="row" style={{ marginTop: 8 }}>
      <span className="muted">Minutos</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        aria-label="Minutos de atividade"
        value={v}
        disabled={disabled}
        style={{ maxWidth: 120 }}
        onFocus={() => (focused.current = true)}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          focused.current = false;
          const n = Math.max(0, Math.floor(Number(v) || 0));
          setV(String(n));
          if (n !== value) onSave(n);
        }}
      />
    </label>
  );
}

