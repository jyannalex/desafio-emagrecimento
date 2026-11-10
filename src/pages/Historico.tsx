import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../data/AppContext';
import { FotoMini } from '../components/Fotos';
import { useToast } from '../components/Toast';
import { AbrirVar, LanceVar, nomeDoPonto, PONTO_ROTULO, SeloVar } from '../components/Var';
import { abrirLance, getLances, getLogs, getMealItems, getPhotos, getProfiles, photoUrls } from '../data/repo';
import { formatKcal, kcalDoItem, qtdTexto, somaKcal } from '../lib/calorias';
import { useToday } from '../hooks/useToday';
import { addDays, formatShort, formatWeekday } from '../lib/dates';
import { playerColors, playerSlot, playerVar } from '../lib/players';
import { anuladosPorDia, ATIVIDADE_META_MIN, dayPoints, MAX_POINTS } from '../lib/scoring';
import type { DailyLog, MealItem, Photo, Ponto, Profile, Tarefa, VarLance } from '../types';

const REFEICOES: { key: 'cafe' | 'almoco' | 'lanche' | 'jantar'; nota: 'nota_cafe' | 'nota_almoco' | 'nota_lanche' | 'nota_jantar'; label: string; foto: string }[] = [
  { key: 'cafe', nota: 'nota_cafe', label: 'Café da manhã', foto: 'do café da manhã' },
  { key: 'almoco', nota: 'nota_almoco', label: 'Almoço', foto: 'do almoço' },
  { key: 'lanche', nota: 'nota_lanche', label: 'Lanche (sem ponto)', foto: 'do lanche' },
  { key: 'jantar', nota: 'nota_jantar', label: 'Jantar', foto: 'do jantar' },
];

export default function Historico() {
  const { userId, challenge } = useApp();
  const today = useToday();
  const toast = useToast();
  const [lances, setLances] = useState<VarLance[]>([]);
  const [chamando, setChamando] = useState<{ alvo: Profile; dia: string; ponto: Ponto } | null>(null);
  const [vendo, setVendo] = useState<VarLance | null>(null);
  const [dados, setDados] = useState<{ profiles: Profile[]; logs: DailyLog[] } | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const [itensDia, setItensDia] = useState<{ dia: string; itens: MealItem[] } | null>(null);
  const [fotosDia, setFotosDia] = useState<{ dia: string; fotos: Photo[]; urls: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    getMealItems(aberto, aberto)
      .then((itens) => vivo && setItensDia({ dia: aberto, itens }))
      .catch(() => {
        /* sem alimentos; o detalhe continua */
      });
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
      getLances()
        .then(setLances)
        .catch(() => {
          /* sem VAR visível; o histórico continua */
        });
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
  const anulados = new Map(dados.profiles.map((p) => [p.id, anuladosPorDia(lances, p.id)]));
  const nomes = Object.fromEntries(dados.profiles.map((p) => [p.id, p.nome]));
  const ativos = lances.filter((l) => l.status !== 'retirado');
  const mudou = (l: VarLance) => {
    setLances((ls) => ls.map((x) => (x.id === l.id ? l : x)));
    setVendo(l);
  };
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
                      const pts = dayPoints(porChave.get(`${p.id}|${d}`), anulados.get(p.id)?.get(d));
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
                        itens={itensDia?.dia === d ? itensDia.itens.filter((i) => i.user_id === p.id) : []}
                        lances={ativos.filter((l) => l.alvo === p.id && l.dia === d)}
                        podeChamar={p.id !== userId}
                        onChamar={(ponto) => setChamando({ alvo: p, dia: d, ponto })}
                        onVer={setVendo}
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {chamando && (
        <AbrirVar
          alvo={`${nomeDoPonto(chamando.ponto, chamando.alvo.nome)} · ${formatShort(chamando.dia)}`}
          onFechar={() => setChamando(null)}
          onAbrir={async (motivo) => {
            try {
              const novo = await abrirLance({ alvo: chamando.alvo.id, autor: userId, dia: chamando.dia, ponto: chamando.ponto, motivo });
              setLances((ls) => [...ls, novo]);
              setChamando(null);
            } catch {
              toast('Não deu para abrir o VAR: o ponto mudou ou já tem um lance. Tente de novo.');
              getLances().then(setLances).catch(() => {});
            }
          }}
        />
      )}
      {vendo && (
        <LanceVar
          lance={vendo}
          meuId={userId}
          nomes={nomes}
          onMudou={mudou}
          onRecarregar={() =>
            getLances()
              .then((ls) => {
                setLances(ls);
                setVendo((v) => (v ? (ls.find((x) => x.id === v.id) ?? null) : null));
              })
              .catch(() => {})
          }
          onFechar={() => setVendo(null)}
        />
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

function Detalhe({
  nome,
  cor,
  log,
  fotos,
  urls,
  itens,
  lances,
  podeChamar,
  onChamar,
  onVer,
}: {
  nome: string;
  cor: string;
  log?: DailyLog;
  fotos: Photo[];
  urls: Record<string, string>;
  itens: MealItem[];
  /** lances abertos ou aceitos desta pessoa neste dia */
  lances: VarLance[];
  podeChamar: boolean;
  onChamar: (p: Ponto) => void;
  onVer: (l: VarLance) => void;
}) {
  /** Selo do lance, ou o botão VAR (só no ponto feito do outro, sem lance). */
  const var_ = (ponto: Ponto, feito: boolean) => {
    const l = lances.find((x) => x.ponto === ponto);
    if (l) return <SeloVar lance={l} onAbrir={() => onVer(l)} />;
    if (!podeChamar || !feito) return null;
    return (
      <button type="button" className="var-btn" aria-label={`Chamar o VAR: ${PONTO_ROTULO[ponto]} de ${nome}`} onClick={() => onChamar(ponto)}>
        VAR
      </button>
    );
  };
  const anulado = (ponto: Ponto) => lances.some((x) => x.ponto === ponto && x.status === 'aceito');
  const foto = (t: Tarefa, rotulo: string) => {
    const f = fotos.find((x) => x.tarefa === t);
    return f ? <FotoMini rotulo={`${rotulo} de ${nome}`} url={urls[f.path]} /> : null;
  };
  return (
    <div className="detail-col">
      <h3 style={{ color: cor }}>{nome}</h3>
      {!log && !itens.length ? (
        <p className="muted small" style={{ margin: 0 }}>
          Nada registrado neste dia.
        </p>
      ) : (
        <ul>
          {REFEICOES.map((r) => (
            <Item key={r.key} ok={!!log?.[r.key]}>
              <span className={r.key !== 'lanche' && anulado(r.key) ? 'anulado' : undefined}>{r.label}</span>
              {r.key !== 'lanche' && var_(r.key, !!log?.[r.key])}
              {log?.[r.nota] && <span className="nota">{log[r.nota]}</span>}
              {itens
                .filter((i) => i.refeicao === r.key)
                .map((i) => (
                  <span className="nota" key={i.id}>
                    {i.nome} · {qtdTexto(i)} · {formatKcal(kcalDoItem(i))}
                  </span>
                ))}
              {foto(r.key, r.foto)}
            </Item>
          ))}
          {log && (
            <>
              <Item ok={log.atividade_min >= ATIVIDADE_META_MIN}>
                <span className={anulado('atividade') ? 'anulado' : undefined}>Atividade física · {log.atividade_min} min</span>
                {var_('atividade', log.atividade_min >= ATIVIDADE_META_MIN)}
                {log.nota_atividade && <span className="nota">{log.nota_atividade}</span>}
                {foto('atividade', 'da atividade')}
              </Item>
              <Item ok={log.agua_ml >= log.meta_agua_ml_do_dia}>
                <span className={anulado('agua') ? 'anulado' : undefined}>
                  Água · {log.agua_ml} / {log.meta_agua_ml_do_dia} ml
                </span>
                {var_('agua', log.agua_ml >= log.meta_agua_ml_do_dia)}
              </Item>
            </>
          )}
        </ul>
      )}
      {itens.length > 0 && (
        <p className="small" style={{ margin: '8px 0 0', fontWeight: 700 }}>
          Total: {formatKcal(somaKcal(itens))}
        </p>
      )}
    </div>
  );
}
