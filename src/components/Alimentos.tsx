import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAlimentos } from '../hooks/useAlimentos';
import { buscarAlimentos, formatKcal, kcalItem, kcalPor100, KCAL_100G_MAX, lerGramas, somaKcal } from '../lib/calorias';
import type { Food, MealItem } from '../types';
import { useToast } from './Toast';

const fmtG = (g: number) => `${g.toLocaleString('pt-BR')} g`;
const paraCampo = (n: number) => String(n).replace('.', ',');
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Janela por cima da tela. Fecha no X, no Esc ou tocando fora. */
export function Folha({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer-box folha">
        <div className="viewer-head">
          <strong>{titulo}</strong>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Lista do que foi comido numa refeição, com subtotal e o botão para adicionar. */
export function ItensRefeicao({
  userId,
  rotulo,
  itens,
  podeEditar,
  onAdicionar,
  onMudar,
  onRemover,
}: {
  userId: string;
  rotulo: string;
  itens: MealItem[];
  podeEditar: boolean;
  onAdicionar: (food: Food, gramas: number) => void;
  onMudar: (id: number, gramas: number) => void;
  onRemover: (id: number) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [editando, setEditando] = useState<MealItem | null>(null);
  if (!itens.length && !podeEditar) return null;

  return (
    <div className="itens">
      {itens.length > 0 && (
        <ul className="itens-lista">
          {itens.map((i) => {
            const kcal = formatKcal(kcalItem(i.gramas, i.kcal_100g));
            const conteudo = (
              <>
                <span className="item-nome">{i.nome}</span>
                <span className="item-g">{fmtG(i.gramas)}</span>
                <span className="item-kcal">{kcal}</span>
              </>
            );
            return (
              <li key={i.id}>
                {podeEditar && i.id > 0 ? (
                  <button type="button" className="item-row" aria-label={`${i.nome}, ${fmtG(i.gramas)}, ${kcal}`} onClick={() => setEditando(i)}>
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
      <div className="itens-pe">
        {podeEditar ? (
          <button type="button" className="btn ghost small" aria-label={`Adicionar alimento no ${rotulo}`} onClick={() => setBuscando(true)}>
            + Alimento
          </button>
        ) : (
          <span />
        )}
        {itens.length > 0 && <span className="itens-total">{formatKcal(somaKcal(itens))}</span>}
      </div>

      {buscando && (
        <BuscaAlimento
          userId={userId}
          onFechar={() => setBuscando(false)}
          onEscolher={(food, g) => {
            setBuscando(false);
            onAdicionar(food, g);
          }}
        />
      )}
      {editando && (
        <EditarItem
          item={editando}
          onFechar={() => setEditando(null)}
          onSalvar={(g) => {
            setEditando(null);
            onMudar(editando.id, g);
          }}
          onRemover={() => {
            setEditando(null);
            onRemover(editando.id);
          }}
        />
      )}
    </div>
  );
}

type Etapa = { tipo: 'busca' } | { tipo: 'gramas'; food: Food } | { tipo: 'cadastro'; nome: string };

/** Buscar no catálogo → digitar gramas → adicionar. Sem o alimento, cadastra ali mesmo. */
export function BuscaAlimento({ userId, onEscolher, onFechar }: { userId: string; onEscolher: (food: Food, gramas: number) => void; onFechar: () => void }) {
  const al = useAlimentos(userId);
  const toast = useToast();
  const [termo, setTermo] = useState('');
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'busca' });
  const achados = useMemo(() => (al.catalogo ? buscarAlimentos(al.catalogo, termo, al.recentes) : []), [al.catalogo, al.recentes, termo]);

  let corpo: ReactNode;
  if (etapa.tipo === 'gramas') {
    corpo = (
      <CampoGramas
        food={etapa.food}
        acao="Adicionar"
        onConfirmar={(g) => onEscolher(etapa.food, g)}
        extra={
          <button type="button" className="btn ghost" onClick={() => setEtapa({ tipo: 'busca' })}>
            Voltar
          </button>
        }
      />
    );
  } else if (etapa.tipo === 'cadastro') {
    corpo = (
      <FormAlimento
        inicial={{ nome: etapa.nome }}
        onCancelar={() => setEtapa({ tipo: 'busca' })}
        onSalvar={async (nome, kcal, g) => {
          try {
            const novo = await al.cadastrar(nome, kcal, g);
            setEtapa({ tipo: 'gramas', food: novo });
          } catch {
            toast('Não foi salvo, tente de novo');
          }
        }}
      />
    );
  } else if (al.erro) {
    corpo = (
      <div className="notice danger">
        Não foi possível carregar os alimentos{' '}
        <button type="button" className="btn" onClick={al.recarregar}>
          Tentar de novo
        </button>
      </div>
    );
  } else {
    const vazio = !termo.trim();
    corpo = (
      <>
        <input
          className="input"
          type="search"
          aria-label="Buscar alimento"
          placeholder="Buscar alimento (ex.: arroz, frango)"
          value={termo}
          autoFocus
          onChange={(e) => setTermo(e.target.value)}
        />
        {!al.catalogo ? (
          <p className="muted small">Carregando os alimentos…</p>
        ) : (
          <>
            {vazio && <p className="muted small busca-titulo">{achados.length ? 'Usados recentemente' : 'Digite para buscar'}</p>}
            {!vazio && !achados.length && <p className="muted small busca-titulo">Nenhum alimento com esse nome</p>}
            <ul className="busca-lista">
              {achados.map((f) => (
                <li key={f.id}>
                  <button type="button" className="busca-item" onClick={() => setEtapa({ tipo: 'gramas', food: f })}>
                    <span>{f.nome}</span>
                    <span className="muted small">{formatKcal(f.kcal_100g)}/100 g</span>
                  </button>
                </li>
              ))}
            </ul>
            {!vazio && (
              <button type="button" className="btn ghost" onClick={() => setEtapa({ tipo: 'cadastro', nome: maiuscula(termo.trim()) })}>
                Cadastrar "{termo.trim()}"
              </button>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <Folha titulo="Adicionar alimento" onClose={onFechar}>
      {corpo}
    </Folha>
  );
}

/** Nome do alimento, campo de gramas e as kcal ao vivo. */
function CampoGramas({
  food,
  inicial = '',
  acao,
  onConfirmar,
  extra,
}: {
  food: Pick<Food, 'nome' | 'kcal_100g'>;
  inicial?: string;
  acao: string;
  onConfirmar: (g: number) => void;
  extra?: ReactNode;
}) {
  const [txt, setTxt] = useState(inicial);
  const g = lerGramas(txt);
  return (
    <form
      className="campo-gramas"
      onSubmit={(e) => {
        e.preventDefault();
        if (g) onConfirmar(g);
      }}
    >
      <p className="gramas-alimento">
        <strong>{food.nome}</strong>
        <span className="muted small">{formatKcal(food.kcal_100g)} em 100 g</span>
      </p>
      <label className="gramas-linha">
        <input className="input" aria-label="Gramas" inputMode="decimal" autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="0" />
        <span>g</span>
        <span className="gramas-kcal">{g ? `= ${formatKcal(kcalItem(g, food.kcal_100g))}` : ''}</span>
      </label>
      {txt.trim() && !g && <p className="muted small">Digite um peso entre 1 e 5.000 g</p>}
      <div className="viewer-actions">
        {extra}
        <button type="submit" className="btn primary" disabled={!g}>
          {acao}
        </button>
      </div>
    </form>
  );
}

export function EditarItem({ item, onSalvar, onRemover, onFechar }: { item: MealItem; onSalvar: (g: number) => void; onRemover: () => void; onFechar: () => void }) {
  return (
    <Folha titulo={item.nome} onClose={onFechar}>
      <CampoGramas
        food={item}
        inicial={paraCampo(item.gramas)}
        acao="Salvar"
        onConfirmar={onSalvar}
        extra={
          <button type="button" className="btn danger" onClick={onRemover}>
            Remover
          </button>
        }
      />
    </Folha>
  );
}

const lerNumero = (s: string) => {
  const t = s.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : null;
};

/** Cadastro/edição de alimento. As kcal podem vir da embalagem em qualquer porção; grava em 100 g. */
export function FormAlimento({
  inicial,
  onSalvar,
  onCancelar,
}: {
  inicial?: { nome: string; kcal_100g?: number };
  onSalvar: (nome: string, kcal: number, gramas: number) => Promise<void> | void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [kcal, setKcal] = useState(inicial?.kcal_100g !== undefined ? paraCampo(inicial.kcal_100g) : '');
  const [gramas, setGramas] = useState('100');
  const [salvando, setSalvando] = useState(false);
  const k = lerNumero(kcal);
  const g = lerGramas(gramas);
  const por100 = k !== null && g ? kcalPor100(k, g) : null;
  const nomeOk = nome.trim().length >= 2 && nome.trim().length <= 80;
  const kcalOk = por100 !== null && por100 <= KCAL_100G_MAX;
  const ok = nomeOk && kcalOk && !salvando;

  return (
    <form
      className="form-alimento"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || k === null || !g) return;
        setSalvando(true);
        try {
          await onSalvar(nome.trim(), k, g);
        } finally {
          setSalvando(false);
        }
      }}
    >
      <label className="field">
        <span>Nome</span>
        <input className="input" aria-label="Nome" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} />
      </label>
      <p className="muted small">Copie da embalagem: as calorias e a porção em gramas.</p>
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
      {por100 !== null && (kcalOk ? <p className="small">= {formatKcal(por100)} em 100 g</p> : <p className="small danger-text">Passa de 900 kcal em 100 g, confira os números</p>)}
      <div className="viewer-actions">
        <button type="button" className="btn ghost" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn primary" disabled={!ok}>
          Salvar alimento
        </button>
      </div>
    </form>
  );
}
