import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../data/AppContext';
import { getLogs, getProfiles } from '../data/repo';
import { useToday } from '../hooks/useToday';
import { addDays, formatShort, formatWeekday } from '../lib/dates';
import { playerSlot, playerVar } from '../lib/players';
import { ATIVIDADE_META_MIN, dayPoints, MAX_POINTS } from '../lib/scoring';
import type { DailyLog, Profile } from '../types';

const REFEICOES: { key: 'cafe' | 'almoco' | 'lanche' | 'jantar'; nota: 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar'; label: string }[] = [
  { key: 'cafe', nota: 'nota_cafe', label: 'Café da manhã' },
  { key: 'almoco', nota: 'nota_almoco', label: 'Almoço' },
  { key: 'lanche', nota: 'nota_lanche', label: 'Lanche' },
  { key: 'jantar', nota: 'nota_jantar', label: 'Jantar' },
];

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

  const head = (
    <>
      <h1>Histórico</h1>
      <p className="muted" style={{ margin: '0 0 18px' }}>Toque num dia para ver o que cada um registrou.</p>
    </>
  );

  if (erro) {
    return (
      <main className="page">
        {head}
        <div className="notice danger">
          Não foi possível carregar o histórico.{' '}
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
        {head}
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  const ultimo = today < challenge.data_fim ? today : challenge.data_fim;
  const dias: string[] = [];
  for (let d = ultimo; d >= challenge.data_inicio; d = addDays(d, -1)) dias.push(d);

  const porChave = new Map(dados.logs.map((l) => [`${l.user_id}|${l.dia}`, l]));
  const pessoas = [...dados.profiles]
    .map((p) => ({ p, slot: playerSlot(dados.profiles, p.id) }))
    .sort((x, y) => x.slot - y.slot);

  return (
    <main className="page">
      {head}
      {dias.length === 0 ? (
        <div className="notice">O desafio ainda não começou.</div>
      ) : (
        <section className="panel" style={{ padding: '6px 14px' }}>
          <ul className="day-list">
            {dias.map((d) => (
              <li key={d} data-testid={`dia-${d}`}>
                <button className="day-row" onClick={() => setAberto(aberto === d ? null : d)} aria-expanded={aberto === d}>
                  <span className="day-date">
                    <strong>{d === today ? 'Hoje' : formatWeekday(d)}</strong>
                    <span className="muted small">{formatShort(d)}</span>
                  </span>
                  <span className="pips">
                    {pessoas.map(({ p, slot }) => {
                      const pts = dayPoints(porChave.get(`${p.id}|${d}`));
                      return (
                        <span className="pip-line" key={p.id} aria-label={`${p.nome}: ${pts} de ${MAX_POINTS}`}>
                          <span className="pip-dots" aria-hidden>
                            {Array.from({ length: MAX_POINTS }, (_, i) => (
                              <i key={i} style={i < pts ? { background: playerVar(slot) } : undefined} />
                            ))}
                          </span>
                          <span aria-hidden style={{ color: playerVar(slot), minWidth: 10 }}>
                            {pts}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                </button>
                {aberto === d && (
                  <div className="day-detail" data-testid={`detalhe-${d}`}>
                    {pessoas.map(({ p, slot }) => (
                      <Detalhe key={p.id} nome={p.nome} cor={playerVar(slot)} log={porChave.get(`${p.id}|${d}`)} />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function Item({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? 'ok' : 'no'}>
      <span aria-label={ok ? 'feito' : 'não feito'}>{ok ? '✓' : '✗'}</span> {children}
    </li>
  );
}

function Detalhe({ nome, cor, log }: { nome: string; cor: string; log?: DailyLog }) {
  return (
    <div className="detail-col">
      <h3 style={{ color: cor }}>{nome}</h3>
      {!log ? (
        <p className="muted small" style={{ margin: 0 }}>
          Nada registrado neste dia.
        </p>
      ) : (
        <ul>
          {REFEICOES.map((r) => (
            <Item key={r.key} ok={log[r.key]}>
              {r.label}
              {log[r.nota] && <span className="nota">{log[r.nota]}</span>}
            </Item>
          ))}
          <Item ok={log.atividade_min >= ATIVIDADE_META_MIN}>
            Atividade física · {log.atividade_min} min
            {log.nota_atividade && <span className="nota">{log.nota_atividade}</span>}
          </Item>
          <Item ok={log.agua_ml >= log.meta_agua_ml_do_dia}>
            Água · {log.agua_ml} / {log.meta_agua_ml_do_dia} ml
          </Item>
        </ul>
      )}
    </div>
  );
}
