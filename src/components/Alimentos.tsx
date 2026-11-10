import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAlimentos } from '../hooks/useAlimentos';
import type { MedidaFood } from '../data/repo';
import {
  buscarAlimentos,
  formatKcal,
  kcalDoItem,
  kcalItem,
  kcalPor100,
  kcalTexto,
  KCAL_100G_MAX,
  KCAL_UNIDADE_MAX,
  lerGramas,
  lerNumero,
  lerUnidades,
  qtdTexto,
} from '../lib/calorias';
import type { Food, MealItem } from '../types';
import { useToast } from './Toast';

const paraCampo = (n: number) => String(n).replace('.', ',');
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const porUnidade = (f: Pick<Food, 'kcal_unidade'>) => f.kcal_unidade != null;
/** kcal de uma quantidade (g ou un) de um alimento. */
const kcalDe = (f: Pick<Food, 'kcal_100g' | 'kcal_unidade'>, q: number) =>
  porUnidade(f) ? Math.round(q * (f.kcal_unidade ?? 0)) : kcalItem(q, f.kcal_100g ?? 0);
const lerQtd = (f: Pick<Food, 'kcal_unidade'>, s: string) => (porUnidade(f) ? lerUnidades(s) : lerGramas(s));

/** Janela que sobe de baixo (no celular) ou fica no centro. Fecha no X, no Esc ou tocando fora. */
export function Folha({ titulo, onClose, children, rodape }: { titulo: string; onClose: () => void; children: ReactNode; rodape?: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="viewer sheet-wrap" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer-box folha">
        <div className="sheet-grip" aria-hidden />
        <div className="viewer-head">
          <strong className="sheet-title">{titulo}</strong>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {rodape && <div className="sheet-foot">{rodape}</div>}
      </div>
    </div>
  );
}

/** O que foi comido numa refeição e a linha para adicionar mais. */
export function ItensRefeicao({
  userId,
  rotulo,
  itens,
  podeEditar,
  onAdicionar,
  onMudar,
  onRemover,
  buscando: buscandoFora,
  onBuscando,
}: {
  userId: string;
  rotulo: string;
  itens: MealItem[];
  podeEditar: boolean;
  /** Devolve false se não salvou (aí não conta como adicionado). */
  onAdicionar: (food: Food, qtd: number) => Promise<boolean> | boolean | void;
  onMudar: (id: number, qtd: number) => void;
  onRemover: (id: number) => void;
  /** Para abrir a busca de fora (ex.: ao marcar a refeição). Sem isso, controla sozinho. */
  buscando?: boolean;
  onBuscando?: (v: boolean) => void;
}) {
  const [buscandoDentro, setBuscandoDentro] = useState(false);
  const buscando = buscandoFora ?? buscandoDentro;
  const setBuscando = onBuscando ?? setBuscandoDentro;
  const [editando, setEditando] = useState<MealItem | null>(null);
  if (!itens.length && !podeEditar) return null;

  return (
    <div className="itens">
      {itens.length > 0 && (
        <ul className="itens-lista">
          {itens.map((i) => {
            const kcal = formatKcal(kcalDoItem(i));
            const conteudo = (
              <>
                <span className="item-nome">{i.nome}</span>
                <span className="item-g">{qtdTexto(i)}</span>
                <span className="item-kcal">{kcal}</span>
              </>
            );
            return (
              <li key={i.id}>
                {podeEditar && i.id > 0 ? (
                  <button type="button" className="item-row" aria-label={`${i.nome}, ${qtdTexto(i)}, ${kcal}`} onClick={() => setEditando(i)}>
                    {conteudo}
                  </button>
                ) : (
                  <div className="item-row">{conteudo}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {podeEditar && (
        <button type="button" className="add-row" aria-label={`Adicionar alimento no ${rotulo}`} onClick={() => setBuscando(true)}>
          <span className="add-plus" aria-hidden>
            +
          </span>
          Adicionar alimento
        </button>
      )}

      {buscando && <BuscaAlimento userId={userId} titulo={`Adicionar ao ${rotulo}`} onFechar={() => setBuscando(false)} onAdicionar={onAdicionar} />}
      {editando && (
        <Folha titulo={editando.nome} onClose={() => setEditando(null)}>
          <EditorQtd
            food={editando}
            inicial={paraCampo(editando.unidades ?? editando.gramas ?? 0)}
            acao="Salvar"
            onConfirmar={(q) => {
              setEditando(null);
              onMudar(editando.id, q);
            }}
            extra={
              <button
                type="button"
                className="btn danger"
                onClick={() => {
                  setEditando(null);
                  onRemover(editando.id);
                }}
              >
                Remover
              </button>
            }
          />
        </Folha>
      )}
    </div>
  );
}

/**
 * Buscar e lançar vários alimentos sem fechar: tocar num resultado abre a quantidade ali mesmo.
 * Sem texto, "Repetir" lança com a última quantidade usada. Sem resultado, cadastra ali mesmo.
 */
export function BuscaAlimento({
  userId,
  titulo,
  onAdicionar,
  onFechar,
}: {
  userId: string;
  titulo: string;
  onAdicionar: (food: Food, qtd: number) => Promise<boolean> | boolean | void;
  onFechar: () => void;
}) {
  const al = useAlimentos(userId);
  const toast = useToast();
  const busca = useRef<HTMLInputElement>(null);
  const [termo, setTermo] = useState('');
  const [foco, setFoco] = useState<Food | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [adicionados, setAdicionados] = useState<number[]>([]);
  const vazio = !termo.trim();
  const achados = useMemo(
    () => (al.catalogo && !vazio ? buscarAlimentos(al.catalogo, termo, al.recentes.map((r) => r.food_id)) : []),
    [al.catalogo, al.recentes, termo, vazio],
  );
  const repetir = useMemo(() => {
    const porId = new Map((al.catalogo ?? []).map((f) => [f.id, f]));
    return al.recentes
      .map((r) => ({ food: porId.get(r.food_id), qtd: r.qtd }))
      .filter((r): r is { food: Food; qtd: number } => !!r.food && lerQtd(r.food, paraCampo(r.qtd)) !== null);
  }, [al.catalogo, al.recentes]);

  async function adicionar(food: Food, q: number) {
    const ok = await onAdicionar(food, q);
    if (ok === false) return;
    setAdicionados((l) => [...l, kcalDe(food, q)]);
    setTermo('');
    setFoco(null);
    setCadastrando(false);
    busca.current?.focus();
  }

  async function salvarNovo(nome: string, medida: MedidaFood) {
    try {
      const novo = await al.cadastrar(nome, medida);
      setCadastrando(false);
      setFoco(novo);
    } catch {
      toast('Não foi salvo, tente de novo');
    }
  }

  const editor = (food: Food) => <EditorQtd key={food.id} food={food} acao="Adicionar" compacto onConfirmar={(q) => adicionar(food, q)} />;
  const linha = (food: Food) => (
    <li key={food.id} className={foco?.id === food.id ? 'aberto' : undefined}>
      <button type="button" className="busca-item" aria-expanded={foco?.id === food.id} onClick={() => setFoco(foco?.id === food.id ? null : food)}>
        <span>{food.nome}</span>
        <span className="muted small">{kcalTexto(food)}</span>
      </button>
      {foco?.id === food.id && editor(food)}
    </li>
  );

  const total = adicionados.reduce((a, b) => a + b, 0);
  const rodape =
    adicionados.length > 0 ? (
      <>
        <span role="status" className="sheet-resumo">
          {adicionados.length === 1 ? '1 item' : `${adicionados.length} itens`} · {formatKcal(total)}
        </span>
        <button type="button" className="btn primary" onClick={onFechar}>
          Concluir
        </button>
      </>
    ) : null;

  let corpo: ReactNode;
  if (al.erro) {
    corpo = (
      <div className="notice danger">
        Não foi possível carregar os alimentos{' '}
        <button type="button" className="btn" onClick={al.recarregar}>
          Tentar de novo
        </button>
      </div>
    );
  } else {
    const pinado = foco && !achados.some((f) => f.id === foco.id) && !repetir.some((r) => r.food.id === foco.id && vazio);
    corpo = (
      <>
        <div className="busca-campo">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            ref={busca}
            className="input"
            type="search"
            aria-label="Buscar alimento"
            placeholder="Buscar alimento (ex.: arroz, frango)"
            value={termo}
            autoFocus
            onChange={(e) => {
              setTermo(e.target.value);
              setFoco(null);
              setCadastrando(false);
            }}
          />
        </div>
        {!al.catalogo ? (
          <p className="muted small">Carregando os alimentos…</p>
        ) : (
          <>
            {pinado && foco && <ul className="busca-lista">{linha(foco)}</ul>}
            {vazio && !pinado && (
              <>
                {repetir.length > 0 ? (
                  <>
                    <p className="busca-titulo">Repetir</p>
                    <ul className="busca-lista">
                      {repetir.map(({ food, qtd }) => (
                        <li key={food.id}>
                          <button
                            type="button"
                            className="busca-item repetir"
                            aria-label={`Repetir ${food.nome}, ${qtdTexto(porUnidade(food) ? { gramas: null, kcal_100g: null, unidades: qtd, kcal_unidade: food.kcal_unidade } : { gramas: qtd, kcal_100g: food.kcal_100g, unidades: null, kcal_unidade: null })}`}
                            onClick={() => adicionar(food, qtd)}
                          >
                            <span>
                              {food.nome}
                              <span className="muted small"> · {porUnidade(food) ? `${paraCampo(qtd)} un` : `${paraCampo(qtd)} g`}</span>
                            </span>
                            <span className="repetir-kcal">
                              {formatKcal(kcalDe(food, qtd))}
                              <span className="add-plus" aria-hidden>
                                +
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="muted small busca-titulo">Digite para buscar. Os que você usar aparecem aqui para repetir com um toque.</p>
                )}
              </>
            )}
            {!vazio && !foco && (cadastrando || achados.length === 0) && (
              <div className="cad-box">
                {achados.length === 0 && <p className="small busca-titulo">Nenhum alimento com esse nome. Cadastre aqui:</p>}
                <FormAlimento
                  key={termo.trim()}
                  inicial={{ nome: maiuscula(termo.trim()) }}
                  onSalvar={salvarNovo}
                  onCancelar={achados.length ? () => setCadastrando(false) : undefined}
                />
              </div>
            )}
            {!vazio && achados.length > 0 && !cadastrando && (
              <>
                {!foco && (
                  <button type="button" className="btn ghost small busca-atalho" onClick={() => setCadastrando(true)}>
                    Não achou? Cadastrar "{termo.trim()}"
                  </button>
                )}
                <ul className="busca-lista">{achados.map(linha)}</ul>
              </>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <Folha titulo={titulo} onClose={onFechar} rodape={rodape}>
      {corpo}
    </Folha>
  );
}

/** Quantidade de um alimento: atalhos, botões − e +, campo e as kcal ao vivo. */
function EditorQtd({
  food,
  inicial = '',
  acao,
  onConfirmar,
  extra,
  compacto,
}: {
  food: Pick<Food, 'nome' | 'kcal_100g' | 'kcal_unidade'>;
  inicial?: string;
  acao: string;
  onConfirmar: (q: number) => void;
  extra?: ReactNode;
  /** Dentro da lista da busca: sem repetir o nome do alimento. */
  compacto?: boolean;
}) {
  const [txt, setTxt] = useState(inicial);
  const un = porUnidade(food);
  const q = lerQtd(food, txt);
  const passo = un ? 0.5 : 10;
  const atalhos = un ? [0.5, 1, 2, 3] : [50, 100, 150, 200];
  const sufixo = un ? 'un' : 'g';
  const atual = lerNumero(txt) ?? 0;
  const mudar = (d: number) => setTxt(paraCampo(Math.max(passo, Math.round((atual + d) * 10) / 10)));

  return (
    <form
      className={`qtd${compacto ? ' compacto' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (q) onConfirmar(q);
      }}
    >
      {!compacto && (
        <p className="gramas-alimento">
          <strong>{food.nome}</strong>
          <span className="muted small">{un ? `${formatKcal(food.kcal_unidade ?? 0)} por unidade` : `${formatKcal(food.kcal_100g ?? 0)} em 100 g`}</span>
        </p>
      )}
      <div className="qtd-atalhos">
        {atalhos.map((a) => (
          <button key={a} type="button" className={`chip${q === a ? ' on' : ''}`} aria-label={`${paraCampo(a)} ${sufixo}`} onClick={() => setTxt(paraCampo(a))}>
            {a === 0.5 ? '½' : paraCampo(a)} {sufixo}
          </button>
        ))}
      </div>
      <div className="qtd-linha">
        <button type="button" className="stepper" aria-label={`Menos ${paraCampo(passo)} ${sufixo}`} onClick={() => mudar(-passo)}>
          −
        </button>
        <label className="qtd-campo">
          <input
            className="input"
            aria-label={un ? 'Unidades' : 'Gramas'}
            inputMode="decimal"
            autoFocus
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            placeholder="0"
          />
          <span>{sufixo}</span>
        </label>
        <button type="button" className="stepper" aria-label={`Mais ${paraCampo(passo)} ${sufixo}`} onClick={() => mudar(passo)}>
          +
        </button>
        <span className="gramas-kcal">{q ? `= ${formatKcal(kcalDe(food, q))}` : ''}</span>
      </div>
      {txt.trim() && !q && (
        <p className="muted small">{un ? 'Até 100 unidades, com no máximo 1 casa decimal (ex.: 0,5)' : 'Até 5.000 g, com no máximo 1 casa decimal'}</p>
      )}
      <div className={extra ? 'viewer-actions' : 'qtd-acao'}>
        {extra}
        <button type="submit" className="btn primary" disabled={!q}>
          {acao}
        </button>
      </div>
    </form>
  );
}

/**
 * Cadastro/edição de alimento, por grama ou por unidade.
 * Por grama: kcal da embalagem em qualquer porção, grava em 100 g. Por unidade: kcal de 1 unidade.
 */
export function FormAlimento({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial?: { nome: string; kcal_100g?: number | null; kcal_unidade?: number | null };
  onSalvar: (nome: string, medida: MedidaFood) => Promise<void> | void;
  onCancelar?: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [tipo, setTipo] = useState<'g' | 'un'>(inicial?.kcal_unidade != null ? 'un' : 'g');
  const kcalInicial = inicial?.kcal_unidade ?? inicial?.kcal_100g;
  const [kcal, setKcal] = useState(kcalInicial != null ? paraCampo(kcalInicial) : '');
  const [gramas, setGramas] = useState('100');
  const [salvando, setSalvando] = useState(false);
  const k = lerNumero(kcal);
  const g = lerGramas(gramas);
  const por100 = tipo === 'g' && k !== null && g ? kcalPor100(k, g) : null;
  const nomeOk = nome.trim().length >= 2 && nome.trim().length <= 80;
  const kcalOk = tipo === 'g' ? por100 !== null && por100 <= KCAL_100G_MAX : k !== null && k <= KCAL_UNIDADE_MAX;
  const ok = nomeOk && kcalOk && !salvando;

  return (
    <form
      className="form-alimento"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || k === null) return;
        setSalvando(true);
        try {
          await onSalvar(nome.trim(), tipo === 'g' ? { kcal_100g: por100, kcal_unidade: null } : { kcal_100g: null, kcal_unidade: k });
        } finally {
          setSalvando(false);
        }
      }}
    >
      <div className="seg full" role="group" aria-label="Como medir">
        <button type="button" aria-pressed={tipo === 'g'} onClick={() => setTipo('g')}>
          Por grama
        </button>
        <button type="button" aria-pressed={tipo === 'un'} onClick={() => setTipo('un')}>
          Por unidade
        </button>
      </div>
      <label className="field">
        <span>Nome</span>
        <input className="input" aria-label="Nome" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
      </label>
      {tipo === 'g' ? (
        <>
          <div className="form-alimento-linha">
            <label className="field">
              <span>Calorias (kcal)</span>
              <input className="input" aria-label="Calorias (kcal)" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </label>
            <label className="field">
              <span>Em quantos gramas</span>
              <input className="input" aria-label="Em quantos gramas" inputMode="decimal" value={gramas} onChange={(e) => setGramas(e.target.value)} />
            </label>
          </div>
          {por100 !== null ? (
            kcalOk ? (
              <p className="small form-dica">= {formatKcal(por100)} em 100 g</p>
            ) : (
              <p className="small danger-text">Passa de 900 kcal em 100 g, confira os números</p>
            )
          ) : (
            <p className="muted small form-dica">Copie da embalagem: as calorias e a porção em gramas.</p>
          )}
        </>
      ) : (
        <>
          <label className="field">
            <span>Calorias de 1 unidade (kcal)</span>
            <input className="input" aria-label="Calorias de 1 unidade (kcal)" inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </label>
          {k !== null && !kcalOk ? (
            <p className="small danger-text">Passa de 5.000 kcal numa unidade, confira o número</p>
          ) : (
            <p className="muted small form-dica">Para o que se conta por unidade: uma coxinha, uma fatia, um bombom.</p>
          )}
        </>
      )}
      <div className={onCancelar ? 'viewer-actions' : 'qtd-acao'}>
        {onCancelar && (
          <button type="button" className="btn ghost" onClick={onCancelar}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn primary" disabled={!ok}>
          Salvar alimento
        </button>
      </div>
    </form>
  );
}

/** Configurações: os alimentos que a pessoa cadastrou, com editar e apagar. */
export function MeusAlimentos({ userId }: { userId: string }) {
  const al = useAlimentos(userId);
  const toast = useToast();
  const [form, setForm] = useState<{ food?: Food } | null>(null);
  const meus = (al.catalogo ?? []).filter((f) => f.origem === 'custom' && f.criado_por === userId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  async function apagar(f: Food) {
    if (!window.confirm(`Apagar "${f.nome}"? O que já foi registrado com ele continua no histórico.`)) return;
    try {
      await al.apagar(f.id);
    } catch {
      toast('Não foi apagado, tente de novo');
    }
  }

  return (
    <section className="panel">
      <h2>Meus alimentos</h2>
      {al.erro ? (
        <div className="notice danger">
          Não foi possível carregar os alimentos{' '}
          <button type="button" className="btn" onClick={al.recarregar}>
            Tentar de novo
          </button>
        </div>
      ) : !al.catalogo ? (
        <p className="muted">Carregando…</p>
      ) : meus.length === 0 ? (
        <p style={{ margin: '0 0 12px' }}>Você ainda não cadastrou nenhum alimento</p>
      ) : (
        <ul className="meus-alimentos">
          {meus.map((f) => (
            <li key={f.id}>
              <span className="grow">
                <span>{f.nome}</span>
                <br />
                <span className="muted small">{kcalTexto(f)}</span>
              </span>
              <button type="button" className="btn ghost small" aria-label={`Editar ${f.nome}`} onClick={() => setForm({ food: f })}>
                Editar
              </button>
              <button type="button" className="btn ghost small" aria-label={`Apagar ${f.nome}`} onClick={() => apagar(f)}>
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn block" disabled={!al.catalogo} onClick={() => setForm({})}>
        Cadastrar alimento
      </button>
      <p className="muted small" style={{ margin: '10px 0 0' }}>
        Os dois veem e usam os alimentos cadastrados. Mudar um alimento não altera o que já foi registrado.
      </p>
      {form && (
        <Folha titulo={form.food ? 'Editar alimento' : 'Cadastrar alimento'} onClose={() => setForm(null)}>
          <FormAlimento
            inicial={form.food ? { nome: form.food.nome, kcal_100g: form.food.kcal_100g, kcal_unidade: form.food.kcal_unidade } : undefined}
            onCancelar={() => setForm(null)}
            onSalvar={async (nome, medida) => {
              try {
                if (form.food) await al.editar(form.food.id, nome, medida);
                else await al.cadastrar(nome, medida);
                setForm(null);
              } catch {
                toast('Não foi salvo, tente de novo');
              }
            }}
          />
        </Folha>
      )}
    </section>
  );
}
