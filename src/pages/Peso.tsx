import { useEffect, useState, type FormEvent } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../data/AppContext';
import { deleteWeight, getProfiles, getWeights, upsertWeight } from '../data/repo';
import { formatBR, todayBR } from '../lib/dates';
import { playerSlot, playerVar } from '../lib/players';
import type { Profile, Weight } from '../types';

/** Último kg − primeiro kg (por data), arredondado a 0,1; null com menos de 2 pesagens. */
export function weightDelta(ws: Weight[]): number | null {
  if (ws.length < 2) return null;
  const s = [...ws].sort((a, b) => a.dia.localeCompare(b.dia));
  return Math.round((s[s.length - 1].kg - s[0].kg) * 10) / 10;
}

const fmtKg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDelta = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtKg(Math.abs(n))} kg`;

export default function Peso() {
  const { userId } = useApp();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [weights, setWeights] = useState<Weight[] | null>(null);
  const [erroCarga, setErroCarga] = useState(false);
  const [dia, setDia] = useState(todayBR());
  const [kg, setKg] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    setErroCarga(false);
    try {
      const [ps, ws] = await Promise.all([getProfiles(), getWeights()]);
      setProfiles(ps);
      setWeights(ws);
    } catch {
      setErroCarga(true);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = Number(kg.replace(',', '.').trim());
    if (!kg.trim() || !Number.isFinite(n) || n <= 0 || n >= 400) {
      setErro('Peso inválido');
      return;
    }
    if (!dia || dia > todayBR()) {
      setErro('Data inválida');
      return;
    }
    setSalvando(true);
    try {
      await upsertWeight({ user_id: userId, dia, kg: Math.round(n * 100) / 100 });
      setKg('');
      await carregar();
    } catch {
      setErro('Não salvou, tente de novo');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: number) {
    try {
      await deleteWeight(id);
      await carregar();
    } catch {
      setErro('Não foi possível excluir');
    }
  }

  const pessoas = profiles
    .map((p) => ({ p, slot: playerSlot(profiles, p.id) }))
    .sort((a, b) => a.slot - b.slot)
    .map(({ p, slot }) => ({ p, slot, cor: playerVar(slot), ws: (weights ?? []).filter((w) => w.user_id === p.id) }));

  const dias = [...new Set((weights ?? []).map((w) => w.dia))].sort();
  const serie = dias.map((d) => {
    const ponto: Record<string, string | number> = { dia: formatBR(d).slice(0, 5) };
    for (const { p, ws } of pessoas) {
      const w = ws.find((x) => x.dia === d);
      if (w) ponto[p.id] = w.kg;
    }
    return ponto;
  });

  const minhas = (weights ?? []).filter((w) => w.user_id === userId).sort((a, b) => b.dia.localeCompare(a.dia));

  return (
    <main className="page">
      <h1>Peso</h1>
      <p className="muted" style={{ margin: '0 0 18px' }}>Fica de fora da pontuação. Serve para ver o caminho.</p>

      {erroCarga && (
        <div className="notice danger">
          Não foi possível carregar as pesagens.{' '}
          <button className="btn" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {weights && (
        <section className="panel">
          <div className="deltas">
            {pessoas.map(({ p, ws, cor }) => {
              const d = weightDelta(ws);
              const texto = d === null ? (ws.length === 0 ? 'sem pesagens' : 'só 1 pesagem') : fmtDelta(d);
              return (
                <div className="delta" key={p.id} aria-label={`${p.nome}: ${texto}`}>
                  <div style={{ color: cor, fontWeight: 700 }} aria-hidden>
                    {p.nome}
                  </div>
                  {d === null ? (
                    <div className="muted small" aria-hidden style={{ marginTop: 10 }}>
                      {texto}
                    </div>
                  ) : (
                    <div className="display v num" aria-hidden>
                      {texto}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {serie.length > 1 && (
            <div style={{ width: '100%', height: 220, marginTop: 6 }}>
              <ResponsiveContainer>
                <LineChart data={serie} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fill: 'var(--ink-2)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fill: 'var(--ink-2)', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => String(Math.round(v))}
                  />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--ink)' }}
                    formatter={(v: number, id: string) => [`${fmtKg(v)} kg`, pessoas.find((x) => x.p.id === id)?.p.nome ?? '']}
                  />
                  {/* cor via CSS (.line-p1/.line-p2): atributo SVG não aceita var() */}
                  {pessoas.map(({ p, slot }) => (
                    <Line key={p.id} className={`line-p${slot}`} type="monotone" dataKey={p.id} strokeWidth={3} dot={{ r: 3.5, strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} connectNulls isAnimationActive={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      )}

      <form className="panel" onSubmit={salvar} noValidate>
        <h2>Registrar pesagem</h2>
        <div className="weigh-form">
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={dia} max={todayBR()} onChange={(e) => setDia(e.target.value)} />
          </label>
          <label className="field">
            <span>Peso (kg)</span>
            <input className="input" type="text" inputMode="decimal" placeholder="80,5" value={kg} onChange={(e) => setKg(e.target.value)} />
          </label>
          {erro && <p className="form-msg error" style={{ gridColumn: '1 / -1', margin: 0 }}>{erro}</p>}
          <button className="btn primary" type="submit" disabled={salvando}>
            Salvar peso
          </button>
        </div>
      </form>

      {minhas.length > 0 && (
        <section className="panel">
          <h2>Minhas pesagens</h2>
          <ul className="wlist">
            {minhas.map((w) => (
              <li key={w.id}>
                <span>
                  <strong className="num">{fmtKg(w.kg)} kg</strong> <span className="muted small">em {formatBR(w.dia)}</span>
                </span>
                <button className="icon-btn" aria-label={`Excluir pesagem de ${formatBR(w.dia)}`} onClick={() => excluir(w.id)}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9.5 7V4.5h5V7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
