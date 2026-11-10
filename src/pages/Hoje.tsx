import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../data/AppContext';
import { getProfiles } from '../data/repo';
import { FotoTarefa } from '../components/Fotos';
import { useDailyLog } from '../hooks/useDailyLog';
import { useFotos } from '../hooks/useFotos';
import { useItensDia } from '../hooks/useItensDia';
import { ItensRefeicao } from '../components/Alimentos';
import { formatKcal, somaKcal } from '../lib/calorias';
import { useToday } from '../hooks/useToday';
import { addDays, formatBR, formatLong, formatWeekday, isEditable } from '../lib/dates';
import { playerColors, playerSoftVar, playerVar } from '../lib/players';
import { ATIVIDADE_META_MIN, dayPoints, MAX_POINTS } from '../lib/scoring';
import type { Challenge, Cor } from '../types';

type MealKey = 'cafe' | 'almoco' | 'lanche' | 'jantar';
type NoteKey = 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar';

const MEALS: { key: MealKey; note: NoteKey; label: string; noteLabel: string; foto: string; semPonto?: boolean }[] = [
  { key: 'cafe', note: 'nota_cafe', label: 'Café da manhã', noteLabel: 'O que comeu no café da manhã', foto: 'do café da manhã' },
  { key: 'almoco', note: 'nota_almoco', label: 'Almoço', noteLabel: 'O que comeu no almoço', foto: 'do almoço' },
  { key: 'lanche', note: 'nota_lanche', label: 'Lanche', noteLabel: 'O que comeu no lanche', foto: 'do lanche', semPonto: true },
  { key: 'jantar', note: 'nota_jantar', label: 'Jantar', noteLabel: 'O que comeu no jantar', foto: 'do jantar' },
];

export default function Hoje() {
  const { userId, challenge } = useApp();
  const today = useToday();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<{ meta: number; cor: Cor } | null>(null);
  const [erro, setErro] = useState(false);

  async function carregarPerfil() {
    setErro(false);
    try {
      const ps = await getProfiles();
      setPerfil({ meta: ps.find((p) => p.id === userId)?.meta_agua_ml ?? 2000, cor: playerColors(ps).get(userId) ?? 'tangerina' });
    } catch {
      setErro(true);
    }
  }

  useEffect(() => {
    carregarPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // dias que dá para abrir: do início do desafio até hoje (ou até o fim, se já acabou)
  const min = challenge?.data_inicio ?? today;
  const max = challenge && challenge.data_fim < today ? challenge.data_fim : today;
  const semJanela = max < min; // desafio ainda não começou
  const dia = semJanela ? today : escolhido && escolhido >= min && escolhido <= max ? escolhido : max;
  const ir = (d: string) => {
    if (d >= min && d <= max) setEscolhido(d === today ? null : d);
  };
  const cor = perfil ? ({ '--me': playerVar(perfil.cor), '--me-soft': playerSoftVar(perfil.cor) } as CSSProperties) : undefined;

  return (
    <main className="page" style={cor}>
      <div className="date-nav">
        <button className="icon-btn" aria-label="Dia anterior" disabled={semJanela || dia <= min} onClick={() => ir(addDays(dia, -1))}>
          <Seta dir="esq" />
        </button>
        <input
          className="date-input"
          type="date"
          aria-label="Escolher data"
          value={dia}
          min={min}
          max={semJanela ? min : max}
          disabled={semJanela}
          onChange={(e) => e.target.value && ir(e.target.value)}
        />
        <button className="icon-btn" aria-label="Próximo dia" disabled={semJanela || dia >= max} onClick={() => ir(addDays(dia, 1))}>
          <Seta dir="dir" />
        </button>
        {dia !== today && (
          <button className="btn small-btn" aria-label="Voltar para hoje" onClick={() => setEscolhido(null)}>
            Hoje
          </button>
        )}
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

function Seta({ dir }: { dir: 'esq' | 'dir' }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={dir === 'esq' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );
}

function tituloDia(dia: string, today: string) {
  if (dia === today) return 'Hoje';
  if (dia === addDays(today, -1)) return 'Ontem';
  const w = formatWeekday(dia);
  return w.charAt(0).toUpperCase() + w.slice(1);
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
  const fotos = useFotos(userId, dia);
  const comida = useItensDia(userId, dia);
  // busca aberta em qual refeição; marcar = abriu pelo círculo (só marca depois de adicionar)
  const [busca, setBusca] = useState<{ key: MealKey; marcar: boolean } | null>(null);
  const foto = (t: MealKey | 'atividade', rotulo: string) => (
    <FotoTarefa
      rotulo={rotulo}
      temFoto={!!fotos.fotos[t]}
      url={fotos.urlDe(t)}
      ocupado={!!fotos.ocupado[t]}
      podeEditar={editable && fotos.carregado}
      onEnviar={(f) => fotos.enviar(t, f)}
      onRemover={() => fotos.remover(t)}
    />
  );
  const pts = dayPoints(log);
  const pontuaveis = MEALS.filter((m) => !m.semPonto);
  const refeicoes = pontuaveis.filter((m) => log[m.key]).length;
  const pctAgua = Math.min(100, Math.round((log.agua_ml / log.meta_agua_ml_do_dia) * 100));
  const aguaOk = log.agua_ml >= log.meta_agua_ml_do_dia;
  const pctAtividade = Math.min(100, Math.round((log.atividade_min / ATIVIDADE_META_MIN) * 100));
  const atividadeOk = log.atividade_min >= ATIVIDADE_META_MIN;

  return (
    <>
      <header className="day-head">
        <div className="grow">
          <h1>{tituloDia(dia, today)}</h1>
          <div className="date">{formatLong(dia)}</div>
          {editable && !loading && <p className="muted small" style={{ margin: '8px 0 0' }}>{resumo(pts)}</p>}
          {comida.itens.length > 0 && (
            <span className="kcal-dia">
              {formatKcal(somaKcal(comida.itens))}
              {dia === today ? ' hoje' : ''}
            </span>
          )}
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
      {comida.erro && (
        <div className="notice danger">
          Não foi possível carregar os alimentos do dia.{' '}
          <button className="btn" aria-label="Carregar alimentos de novo" onClick={comida.recarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      <section className="panel">
        <div className="panel-title">
          <h2>Refeições</h2>
          <span className="muted small">{refeicoes} de {pontuaveis.length} na dieta</span>
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
                  disabled={off || !comida.carregado}
                  onChange={(e) => {
                    const semAlimento = !comida.itens.some((i) => i.refeicao === m.key);
                    if (e.target.checked && semAlimento) setBusca({ key: m.key, marcar: true });
                    else update({ [m.key]: e.target.checked });
                  }}
                />
                <span className="task-name">{m.label}</span>
                {m.semPonto && <span className="tag">sem ponto</span>}
              </label>
              <div className="task-sub">
                <ItensRefeicao
                  userId={userId}
                  rotulo={m.foto.slice(3)}
                  itens={comida.itens.filter((i) => i.refeicao === m.key)}
                  podeEditar={editable && comida.carregado}
                  onAdicionar={async (food, g) => {
                    const marcar = busca?.key === m.key && busca.marcar;
                    if ((await comida.adicionar(m.key, food, g)) && marcar) update({ [m.key]: true });
                  }}
                  onMudar={comida.mudarQuantidade}
                  onRemover={comida.remover}
                  buscando={busca?.key === m.key}
                  onBuscando={(v) => setBusca(v ? { key: m.key, marcar: false } : null)}
                  extra={foto(m.key, m.foto)}
                />
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
        <div className="note-row" style={{ marginTop: 10 }}>
          <Nota
            label="Qual atividade você fez"
            placeholder="O que vocês fizeram? Ex.: caminhada, musculação"
            value={log.nota_atividade}
            disabled={off}
            onSave={(v) => update({ nota_atividade: v })}
          />
          {foto('atividade', 'da atividade')}
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

function Nota({
  label,
  value,
  disabled,
  onSave,
  placeholder = 'Anotar o que comeu',
}: {
  label: string;
  value: string | null;
  disabled: boolean;
  onSave: (v: string | null) => void;
  placeholder?: string;
}) {
  const { v, setV, focused } = useSynced(value ?? '');
  return (
    <input
      className="note"
      type="text"
      aria-label={label}
      placeholder={placeholder}
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
