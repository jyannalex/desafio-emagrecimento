import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../data/AppContext';
import { FotoMini } from '../components/Fotos';
import { getLogs, getPhotos, getProfiles, photoUrls } from '../data/repo';
import { useToday } from '../hooks/useToday';
import { addDays, formatShort, formatWeekday } from '../lib/dates';
import { playerColors, playerSlot, playerVar } from '../lib/players';
import { ATIVIDADE_META_MIN, dayPoints, MAX_POINTS } from '../lib/scoring';
import type { DailyLog, Photo, Profile, Tarefa } from '../types';

const REFEICOES: { key: 'cafe' | 'almoco' | 'lanche' | 'jantar'; nota: 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar'; label: string; foto: string }[] = [
  { key: 'cafe', nota: 'nota_cafe', label: 'Café da manhã', foto: 'do café da manhã' },
  { key: 'almoco', nota: 'nota_almoco', label: 'Almoço', foto: 'do almoço' },
  { key: 'lanche', nota: 'nota_lanche', label: 'Lanche (sem ponto)', foto: 'do lanche' },
  { key: 'jantar', nota: 'nota_jantar', label: 'Jantar', foto: 'do jantar' },
];

export default function Historico() {
  const { challenge } = useApp();
  const today = useToday();
  const [dados, setDados] = useState<{ profiles: Profile[]; logs: DailyLog[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [fotosDia, setFotosDia] = useState<{ dia: string; fotos: Photo[]; urls: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    (async () => {
      try {
        const fotos = await getPhotos(aberto, aberto);
        const urls = fotos.length ? await photoUrls(fotos.map((f) => f.path)) : {};
        if (vivo) setFotosDia({ dia: aberto, fotos, urls });
      } catch {
        /* sem fotos; o detalhe continua */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [aberto]);

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
  const cores = playerColors(dados.profiles);
  const pessoas = [...dados.profiles]
    .map((p) => ({ p, slot: playerSlot(dados.profiles, p.id), cor: playerVar(cores.get(p.id)!) }))
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
                    {pessoas.map(({ p, cor }) => {
                      const pts = dayPoints(porChave.get(`${p.id}|${d}`));
                      return (
                        <span className="pip-line" key={p.id} aria-label={`${p.nome}: ${pts} de ${MAX_POINTS}`}>
                          <span className="pip-dots" aria-hidden>
                            {Array.from({ length: MAX_POINTS }, (_, i) => (
                              <i key={i} style={i < pts ? { background: cor } : undefined} />
                            ))}
                          </span>
                          <span aria-hidden style={{ color: cor, minWidth: 10 }}>
                            {pts}
                          </span>
                        </span>
                      );
                    })}
                  </span>
                </button>
                {aberto === d && (
                  <div className="day-detail" data-testid={`detalhe-${d}`}>
                    {pessoas.map(({ p, cor }) => (
                      <Detalhe
                        key={p.id}
                        nome={p.nome}
                        cor={cor}
                        log={porChave.get(`${p.id}|${d}`)}
                        fotos={fotosDia?.dia === d ? fotosDia.fotos.filter((f) => f.user_id === p.id) : []}
                        urls={fotosDia?.urls ?? {}}
                      />
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

function Detalhe({ nome, cor, log, fotos, urls }: { nome: string; cor: string; log?: DailyLog; fotos: Photo[]; urls: Record<string, string> }) {
  const foto = (t: Tarefa, rotulo: string) => {
    const f = fotos.find((x) => x.tarefa === t);
    return f ? <FotoMini rotulo={`${rotulo} de ${nome}`} url={urls[f.path]} /> : null;
  };
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
              {foto(r.key, r.foto)}
            </Item>
          ))}
          <Item ok={log.atividade_min >= ATIVIDADE_META_MIN}>
            Atividade física · {log.atividade_min} min
            {log.nota_atividade && <span className="nota">{log.nota_atividade}</span>}
            {foto('atividade', 'da atividade')}
          </Item>
          <Item ok={log.agua_ml >= log.meta_agua_ml_do_dia}>
            Água · {log.agua_ml} / {log.meta_agua_ml_do_dia} ml
          </Item>
        </ul>
      )}
    </div>
  );
}
