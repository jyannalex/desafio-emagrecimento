import { useEffect, useState } from 'react';
import { useApp } from '../data/AppContext';
import { getLogs, getProfiles } from '../data/repo';
import { formatBR, todayBR } from '../lib/dates';
import { standing, winner, type Score, type Standing } from '../lib/scoring';
import type { DailyLog, Profile } from '../types';

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export default function Ranking() {
  const { challenge } = useApp();
  const [dados, setDados] = useState<{ profiles: Profile[]; logs: DailyLog[] } | null>(null);
  const [erro, setErro] = useState(false);

  async function carregar() {
    if (!challenge) return;
    setErro(false);
    try {
      const [profiles, logs] = await Promise.all([getProfiles(), getLogs(challenge.data_inicio, challenge.data_fim)]);
      setDados({ profiles, logs });
    } catch {
      setErro(true);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.data_inicio, challenge?.data_fim]);

  if (!challenge) return null;
  if (erro) {
    return (
      <main className="page">
        <p className="error">Não foi possível carregar o ranking.</p>
        <button onClick={carregar}>Tentar de novo</button>
      </main>
    );
  }
  if (!dados) {
    return (
      <main className="page">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  const today = todayBR();
  const placares = dados.profiles.map((p, i) => ({
    p,
    cor: i === 0 ? 'var(--p1)' : 'var(--p2)',
    s: standing(dados.logs.filter((l) => l.user_id === p.id), challenge, today),
  }));
  const status = placares[0]?.s.status ?? (today < challenge.data_inicio ? 'antes' : 'andamento');
  const [a, b] = placares;

  let destaque = '';
  let liderId: string | null = null;
  if (a && b) {
    const w = winner({ id: a.p.id, total: a.s.total.points }, { id: b.p.id, total: b.s.total.points });
    const nome = (id: string) => placares.find((x) => x.p.id === id)!.p.nome;
    const diff = Math.abs(a.s.total.points - b.s.total.points);
    if (status === 'encerrado') destaque = w === 'empate' ? 'Empate' : `🏆 ${nome(w)} venceu!`;
    else if (status === 'andamento') destaque = w === 'empate' ? 'Empatados' : `${nome(w)} na frente por ${plural(diff, 'ponto', 'pontos')}`;
    liderId = w === 'empate' ? null : w;
  }

  const restante = (s?: Standing) => {
    const n = s?.diasRestantes ?? 0;
    if (status === 'antes') return n === 0 ? 'Começa amanhã' : `Começa em ${plural(n, 'dia', 'dias')}`;
    if (status === 'encerrado') return `Encerrado em ${formatBR(challenge.data_fim)}`;
    return n === 0 ? 'Último dia!' : `Faltam ${plural(n, 'dia', 'dias')}`;
  };

  return (
    <main className="page">
      <h1>🏆 {challenge.nome}</h1>
      <p className="muted" style={{ marginTop: -8 }}>
        {formatBR(challenge.data_inicio)} a {formatBR(challenge.data_fim)} · <span>{restante(a?.s)}</span>
      </p>
      {destaque && (
        <div className="card" style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}>
          {destaque}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(placares.length, 1)}, minmax(0, 1fr))`, gap: 12 }}>
        {placares.map(({ p, s, cor }) => (
          <div
            key={p.id}
            className="card"
            data-testid={`placar-${p.id}`}
            style={{ borderTop: `4px solid ${cor}`, boxShadow: liderId === p.id ? `0 0 0 2px ${cor}` : undefined }}
          >
            <h2 style={{ color: cor }}>
              {liderId === p.id && status !== 'antes' ? '👑 ' : ''}
              <span>{p.nome}</span>
            </h2>
            <div style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>{s.total.points}</div>
            <div className="muted" style={{ marginBottom: 10 }}>pontos no total</div>
            <Linha nome="Total" id="total" sc={s.total} />
            <Linha nome="Semana" id="semana" sc={s.week} />
            <Linha nome="Hoje" id="hoje" sc={s.today} />
          </div>
        ))}
      </div>
      {placares.length < 2 && <p className="muted">Quando a outra pessoa criar a conta, ela aparece aqui.</p>}
    </main>
  );
}

function Linha({ nome, id, sc }: { nome: string; id: string; sc: Score }) {
  return (
    <div className="row between" style={{ fontSize: '.9rem', padding: '4px 0', borderTop: '1px solid var(--line)' }}>
      <span className="muted">{nome}</span>
      <span data-testid={id}>
        {sc.points} pts · {sc.pct}%
      </span>
    </div>
  );
}
