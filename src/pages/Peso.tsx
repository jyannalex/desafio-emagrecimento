import { useEffect, useState, type FormEvent } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../data/AppContext';
import { deleteWeight, getProfiles, getWeights, upsertWeight } from '../data/repo';
import { formatBR, todayBR } from '../lib/dates';
import type { Profile, Weight } from '../types';

/** Último kg − primeiro kg (por data), arredondado a 0,1; null com menos de 2 pesagens. */
export function weightDelta(ws: Weight[]): number | null {
  if (ws.length < 2) return null;
  const s = [...ws].sort((a, b) => a.dia.localeCompare(b.dia));
  return Math.round((s[s.length - 1].kg - s[0].kg) * 10) / 10;
}

const fmtKg = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDelta = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtKg(Math.abs(n))} kg`;
const CORES = ['var(--p1)', 'var(--p2)'];

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

  const porPessoa = profiles.map((p, i) => ({
    p,
    cor: CORES[i % CORES.length],
    ws: (weights ?? []).filter((w) => w.user_id === p.id),
  }));

  const dias = [...new Set((weights ?? []).map((w) => w.dia))].sort();
  const serie = dias.map((d) => {
    const ponto: Record<string, string | number> = { dia: formatBR(d).slice(0, 5) };
    for (const { p, ws } of porPessoa) {
      const w = ws.find((x) => x.dia === d);
      if (w) ponto[p.nome] = w.kg;
    }
    return ponto;
  });

  const minhas = (weights ?? []).filter((w) => w.user_id === userId).sort((a, b) => b.dia.localeCompare(a.dia));

  return (
    <main className="page">
      <h1>⚖️ Peso</h1>
      <p className="muted" style={{ marginTop: -8 }}>Só para acompanhar, não vale ponto.</p>

      <form className="card" onSubmit={salvar}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow" style={{ marginBottom: 0 }}>
            <span>Data</span>
            <input type="date" value={dia} max={todayBR()} onChange={(e) => setDia(e.target.value)} />
          </label>
          <label className="field grow" style={{ marginBottom: 0 }}>
            <span>Peso (kg)</span>
            <input type="text" inputMode="decimal" placeholder="80,5" value={kg} onChange={(e) => setKg(e.target.value)} />
          </label>
        </div>
        {erro && <p className="error">{erro}</p>}
        <button className="primary" type="submit" disabled={salvando} style={{ width: '100%', marginTop: 12 }}>
          Salvar peso
        </button>
      </form>

      {erroCarga && (
        <div className="card">
          <p className="error">Não foi possível carregar as pesagens.</p>
          <button onClick={carregar}>Tentar de novo</button>
        </div>
      )}

      {weights && (
        <>
          <div className="card">
            {porPessoa.map(({ p, ws, cor }) => {
              const d = weightDelta(ws);
              return (
                <div key={p.id} style={{ color: cor, fontWeight: 600 }}>
                  {d === null ? `${p.nome}: ${ws.length === 0 ? 'sem pesagens' : 'só 1 pesagem'}` : `${p.nome}: ${fmtDelta(d)}`}
                </div>
              );
            })}
            {serie.length > 0 && (
              <div style={{ width: '100%', height: 240, marginTop: 12 }}>
                <ResponsiveContainer>
                  <LineChart data={serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `${fmtKg(v)} kg`} />
                    <Legend />
                    {porPessoa.map(({ p, cor }) => (
                      <Line key={p.id} type="monotone" dataKey={p.nome} stroke={cor} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {minhas.length > 0 && (
            <div className="card">
              <h2>Minhas pesagens</h2>
              {minhas.map((w) => (
                <div key={w.id} className="row between" style={{ padding: '4px 0', borderTop: '1px solid var(--line)' }}>
                  <span>
                    {formatBR(w.dia)} · {fmtKg(w.kg)} kg
                  </span>
                  <button aria-label={`Excluir pesagem de ${formatBR(w.dia)}`} onClick={() => excluir(w.id)}>
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
