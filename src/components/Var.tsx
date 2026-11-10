import { useEffect, useState } from 'react';
import { decidirLance, enviarMensagem, getMensagens } from '../data/repo';
import { formatShort } from '../lib/dates';
import type { Ponto, VarLance, VarMensagem } from '../types';
import { Folha } from './Alimentos';
import { useToast } from './Toast';

export const PONTO_ROTULO: Record<Ponto, string> = {
  cafe: 'café da manhã',
  almoco: 'almoço',
  jantar: 'jantar',
  atividade: 'atividade',
  agua: 'água',
};

/** "almoço de Mari" */
export const nomeDoPonto = (ponto: Ponto, nome: string) => `${PONTO_ROTULO[ponto]} de ${nome}`;

/** Folha para chamar o VAR: só pede o motivo. */
export function AbrirVar({ alvo, onAbrir, onFechar }: { alvo: string; onAbrir: (motivo: string) => Promise<void> | void; onFechar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ok = motivo.trim().length >= 3 && !enviando;
  return (
    <Folha titulo="Chamar o VAR" onClose={onFechar}>
      <form
        className="var-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ok) return;
          setEnviando(true);
          try {
            await onAbrir(motivo.trim());
          } finally {
            setEnviando(false);
          }
        }}
      >
        <p className="var-alvo">{alvo}</p>
        <label className="field">
          <span>Motivo</span>
          <textarea
            className="input var-texto"
            aria-label="Motivo"
            maxLength={300}
            rows={3}
            autoFocus
            placeholder="O que você viu? Ex.: almoço na dieta com coxinha?"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <p className="muted small">O ponto continua valendo até a outra pessoa aceitar a contestação.</p>
        <button type="submit" className="btn primary block" disabled={!ok}>
          Abrir VAR
        </button>
      </form>
    </Folha>
  );
}

const RESULTADO = (l: VarLance, alvo: string, autor: string) =>
  l.status === 'aceito'
    ? `Ponto anulado: ${alvo} aceitou.`
    : l.status === 'retirado'
      ? `Contestação retirada por ${autor}: o ponto ficou.`
      : `Em análise: o ponto vale até ${alvo} aceitar.`;

/** Um lance: motivo, conversa e a decisão (contestado aceita, quem abriu retira). */
export function LanceVar({
  lance,
  meuId,
  nomes,
  onMudou,
  onRecarregar,
  onFechar,
}: {
  lance: VarLance;
  meuId: string;
  nomes: Record<string, string>;
  onMudou: (l: VarLance) => void;
  /** Busca o lance de novo (ex.: o outro decidiu enquanto a folha estava aberta). */
  onRecarregar?: () => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [msgs, setMsgs] = useState<VarMensagem[] | null>(null);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const alvo = nomes[lance.alvo] ?? 'a pessoa';
  const autor = nomes[lance.autor] ?? 'a pessoa';
  const aberto = lance.status === 'aberto';

  useEffect(() => {
    let vivo = true;
    getMensagens(lance.id)
      .then((m) => vivo && setMsgs(m))
      .catch(() => vivo && setMsgs([]));
    return () => {
      vivo = false;
    };
  }, [lance.id]);

  async function decidir(status: 'aceito' | 'retirado') {
    if (status === 'aceito' && !window.confirm(`Aceitar a contestação? Você perde o ponto do ${PONTO_ROTULO[lance.ponto]} de ${formatShort(lance.dia)}.`)) return;
    setOcupado(true);
    try {
      onMudou(await decidirLance(lance.id, status));
    } catch (e) {
      toast(e instanceof Error && e.message.includes('já foi decidido') ? e.message : 'Não foi salvo, tente de novo');
      onRecarregar?.();
    } finally {
      setOcupado(false);
    }
  }

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setOcupado(true);
    try {
      const m = await enviarMensagem({ lance_id: lance.id, autor: meuId, texto: t });
      setMsgs((l) => [...(l ?? []), m]);
      setTexto('');
    } catch {
      toast('Não foi salvo, tente de novo');
      onRecarregar?.();
    } finally {
      setOcupado(false);
    }
  }

  const balao = (quem: string, t: string, key: string | number) => (
    <li key={key} className={`balao${quem === meuId ? ' meu' : ''}`}>
      <span className="balao-quem">{nomes[quem] ?? ''}</span>
      {t}
    </li>
  );

  return (
    <Folha titulo={`VAR: ${nomeDoPonto(lance.ponto, alvo)}`} onClose={onFechar}>
      <p className="muted small var-data">{formatShort(lance.dia)}</p>
      <p className={`var-status ${lance.status}`}>{RESULTADO(lance, alvo, autor)}</p>
      <ul className="conversa">
        {balao(lance.autor, lance.motivo, 'motivo')}
        {msgs?.map((m) => balao(m.autor, m.texto, m.id))}
      </ul>
      {aberto && (
        <>
          <form
            className="var-escrever"
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
          >
            <input
              className="input"
              aria-label="Escrever"
              placeholder={meuId === lance.alvo ? 'Sua defesa…' : 'Responder…'}
              maxLength={300}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <button type="submit" className="btn" disabled={ocupado || !texto.trim()}>
              Enviar
            </button>
          </form>
          {meuId === lance.alvo && (
            <button type="button" className="btn danger block" disabled={ocupado} onClick={() => decidir('aceito')}>
              Aceitar e perder o ponto
            </button>
          )}
          {meuId === lance.autor && (
            <button type="button" className="btn ghost block" disabled={ocupado} onClick={() => decidir('retirado')}>
              Retirar contestação
            </button>
          )}
        </>
      )}
    </Folha>
  );
}

/** Selo no ponto contestado: "em análise" ou "anulado pelo VAR". Lance retirado não mostra nada. */
export function SeloVar({ lance, onAbrir }: { lance: VarLance; onAbrir: () => void }) {
  if (lance.status === 'retirado') return null;
  const texto = lance.status === 'aceito' ? 'anulado pelo VAR' : 'em análise';
  return (
    <button type="button" className={`selo-var ${lance.status}`} aria-label={`Ver lance do VAR: ${texto}`} onClick={onAbrir}>
      📺 {texto}
    </button>
  );
}
