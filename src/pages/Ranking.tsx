import { useEffect, useState } from 'react';
import { useApp } from '../data/AppContext';
import { getLogs, getProfiles } from '../data/repo';
import { useToday } from '../hooks/useToday';
import { formatShort } from '../lib/dates';
import { playerSlot, playerVar } from '../lib/players';
import { standing, winner, type Score, type Standing } from '../lib/scoring';
import type { DailyLog, Profile } from '../types';

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

type Lado = { p: Profile; s: Standing; cor: string };

export default function Ranking() {
  const { challenge } = useApp();
  const today = useToday();
  const [dados, setDados] = useState<{ profiles: Profile[]; logs: DailyLog[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [montado, setMontado] = useState(false);

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

  // a barra começa no meio e corre até o placar: o único movimento da tela
  useEffect(() => {
    if (!dados) return;
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, [dados]);

  if (!challenge) return null;
  if (erro) {
    return (
      <main className="page">
        <h1>Ranking</h1>
        <div className="notice danger">
          Não foi possível carregar o ranking.{' '}
          <button className="btn" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      </main>
    );
  }
  if (!dados) {
    return (
      <main className="page">
        <h1>Ranking</h1>
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  const lados: Lado[] = [...dados.profiles]
    .sort((x, y) => playerSlot(dados.profiles, x.id) - playerSlot(dados.profiles, y.id))
    .map((p) => ({
      p,
      cor: playerVar(playerSlot(dados.profiles, p.id)),
      s: standing(dados.logs.filter((l) => l.user_id === p.id), challenge, today),
    }));
  const [a, b] = lados;
  const status = a?.s.status ?? (today < challenge.data_inicio ? 'antes' : 'andamento');
  const restantes = a?.s.diasRestantes ?? 0;

  let veredito = '';
  let liderId: string | null = null;
  if (a && b) {
    const w = winner({ id: a.p.id, total: a.s.total.points }, { id: b.p.id, total: b.s.total.points });
    const nome = w === a.p.id ? a.p.nome : b.p.nome;
    const diff = Math.abs(a.s.total.points - b.s.total.points);
    liderId = w === 'empate' ? null : w;
    if (status === 'encerrado') veredito = w === 'empate' ? 'Empate' : `🏆 ${nome} venceu!`;
    else if (status === 'andamento') veredito = w === 'empate' ? 'Empatados' : `${nome} na frente por ${plural(diff, 'ponto', 'pontos')}`;
  }

  const quando =
    status === 'antes'
      ? restantes === 1
        ? 'Começa amanhã'
        : `Começa em ${plural(restantes, 'dia', 'dias')}`
      : status === 'encerrado'
        ? 'Desafio encerrado'
        : restantes === 0
          ? 'Último dia!'
          : `Faltam ${plural(restantes, 'dia', 'dias')}`;

  const total = (l?: Lado) => l?.s.total.points ?? 0;
  const soma = total(a) + total(b);
  const flexA = !montado || soma === 0 ? 1 : total(a);
  const flexB = !montado || soma === 0 ? 1 : total(b);

  return (
    <main className="page">
      <h1>{challenge.nome}</h1>
      <p className="muted" style={{ margin: '0 0 18px' }}>
        De {formatShort(challenge.data_inicio)} a {formatShort(challenge.data_fim)}. <span>{quando}</span>
      </p>

      <section className="panel">
        <div className="duel-names">
          {a && <Lado lado={a} lider={liderId === a.p.id} />}
          {b && <Lado lado={b} lider={liderId === b.p.id} direita />}
        </div>
        {a && b && (
          <div className="duel-bar" role="img" aria-label={`${a.p.nome} ${total(a)} × ${total(b)} ${b.p.nome}`}>
            <div style={{ flexGrow: flexA, background: a.cor }} />
            <div style={{ flexGrow: flexB, background: b.cor }} />
          </div>
        )}
        {veredito && <p className="duel-verdict">{veredito}</p>}
        {!b && <p className="muted small">Quando a outra pessoa criar a conta, o duelo começa aqui.</p>}
      </section>

      {a && (
        <section className="panel">
          <table className="versus">
            <tbody>
              <Linha nome="Semana" k="semana" a={a} b={b} pick={(s) => s.week} />
              <Linha nome="Hoje" k="hoje" a={a} b={b} pick={(s) => s.today} />
              <tr>
                <td style={{ color: a.cor }}>{a.s.total.pct}%</td>
                <td className="k">Aproveitamento</td>
                <td style={{ color: b?.cor }}>{b ? `${b.s.total.pct}%` : ''}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function Lado({ lado, lider, direita }: { lado: Lado; lider: boolean; direita?: boolean }) {
  const t = lado.s.total;
  return (
    <div className={`duel-side${direita ? ' right' : ''}`}>
      <div className="who" style={{ color: lado.cor }}>
        {lider && <span aria-label="na frente">👑</span>}
        <span>{lado.p.nome}</span>
      </div>
      <div className="display score num" aria-label={`${lado.p.nome}, total: ${t.points} pontos, ${t.pct}%`}>
        {t.points}
      </div>
      <div className="muted small">pontos</div>
    </div>
  );
}

function Linha({ nome, k, a, b, pick }: { nome: string; k: string; a: Lado; b?: Lado; pick: (s: Standing) => Score }) {
  const cel = (l: Lado) => {
    const sc = pick(l.s);
    return (
      <td aria-label={`${l.p.nome}, ${k}: ${sc.points} pontos, ${sc.pct}%`} style={{ color: l.cor }}>
        {sc.points}
        <span className="pct">{sc.pct}%</span>
      </td>
    );
  };
  return (
    <tr>
      {cel(a)}
      <td className="k">{nome}</td>
      {b ? cel(b) : <td />}
    </tr>
  );
}
