import { useEffect, useState } from 'react';
import { useApp } from '../data/AppContext';
import { getLogs, getProfiles } from '../data/repo';
import { addDays, formatBR } from '../lib/dates';
import { useToday } from '../hooks/useToday';
import { dayPoints, MAX_POINTS } from '../lib/scoring';
import type { DailyLog, Profile } from '../types';

const REFEICOES: { key: 'cafe' | 'almoco' | 'lanche' | 'jantar'; nota: 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar'; label: string }[] = [
  { key: 'cafe', nota: 'nota_cafe', label: 'Café da manhã' },
  { key: 'almoco', nota: 'nota_almoco', label: 'Almoço' },
  { key: 'lanche', nota: 'nota_lanche', label: 'Lanche' },
  { key: 'jantar', nota: 'nota_jantar', label: 'Jantar' },
];

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaSemana = (d: string) => DIAS_SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()];

export default function Historico() {
  const { challenge } = useApp();
  const today = useToday();
  const [dados, setDados] = useState<{ profiles: Profile[]; logs: DailyLog[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

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
        <p className="error">Não foi possível carregar o histórico.</p>
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

  const ultimo = today < challenge.data_fim ? today : challenge.data_fim;
  const dias: string[] = [];
  for (let d = ultimo; d >= challenge.data_inicio; d = addDays(d, -1)) dias.push(d);

  const porChave = new Map(dados.logs.map((l) => [`${l.user_id}|${l.dia}`, l]));

  return (
    <main className="page">
      <h1>📅 Histórico</h1>
      {dias.length === 0 && <p className="muted">O desafio ainda não começou.</p>}
      {dias.map((d) => (
        <div className="card" key={d} data-testid={`dia-${d}`} style={{ padding: 0 }}>
          <button
            onClick={() => setAberto(aberto === d ? null : d)}
            aria-expanded={aberto === d}
            style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', padding: 14 }}
          >
            <div className="row between" style={{ flexWrap: 'wrap' }}>
              <strong>
                {diaSemana(d)} {formatBR(d)}
              </strong>
              <span className="row" style={{ gap: 12 }}>
                {dados.profiles.map((p) => (
                  <span key={p.id}>
                    {p.nome} {dayPoints(porChave.get(`${p.id}|${d}`))}/{MAX_POINTS}
                  </span>
                ))}
              </span>
            </div>
          </button>
          {aberto === d && (
            <div data-testid={`detalhe-${d}`} style={{ padding: '0 14px 14px' }}>
              {dados.profiles.map((p) => (
                <Detalhe key={p.id} nome={p.nome} log={porChave.get(`${p.id}|${d}`)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

const ok = (b: boolean) => (b ? '✅' : '❌');

function Detalhe({ nome, log }: { nome: string; log?: DailyLog }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 4 }}>
      <h2>{nome}</h2>
      {!log ? (
        <p className="muted">Nada registrado.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {REFEICOES.map((r) => (
            <li key={r.key}>
              {ok(log[r.key])} {r.label}
              {log[r.nota] && (
                <div className="muted" style={{ marginLeft: 26 }}>
                  {log[r.nota]}
                </div>
              )}
            </li>
          ))}
          <li>
            {ok(log.atividade)} Atividade física{log.atividade_min > 0 ? ` · ${log.atividade_min} min` : ''}
          </li>
          <li>
            {ok(log.agua_ml >= log.meta_agua_ml_do_dia)} Água · {log.agua_ml} / {log.meta_agua_ml_do_dia} ml
          </li>
        </ul>
      )}
    </div>
  );
}
