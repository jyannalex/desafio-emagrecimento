import { useEffect, useRef, useState, type ReactNode } from 'react';

function Camera() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.9 5h4.2a1.5 1.5 0 0 1 1.3.6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/** Escolher arquivo: no celular abre câmera ou galeria. */
function Escolher({ label, disabled, onFile, className, children }: { label: string; disabled: boolean; onFile: (f: File) => void; className: string; children: ReactNode }) {
  return (
    <label className={`${className}${disabled ? ' off' : ''}`}>
      <input
        type="file"
        accept="image/*"
        aria-label={label}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      {children}
    </label>
  );
}

/**
 * Foto opcional de uma tarefa. Sem foto: botão de câmera. Com foto: miniatura que abre em tela cheia.
 * `rotulo` completa o nome acessível: "do almoço", "da atividade"…
 */
export function FotoTarefa({
  rotulo,
  url,
  temFoto,
  ocupado,
  podeEditar,
  onEnviar,
  onRemover,
}: {
  rotulo: string;
  url?: string;
  temFoto: boolean;
  ocupado: boolean;
  podeEditar: boolean;
  onEnviar: (f: File) => void;
  onRemover: () => void;
}) {
  const [aberta, setAberta] = useState(false);

  if (ocupado && !aberta) {
    return (
      <span className="foto-slot" role="status" aria-label={`Enviando foto ${rotulo}`}>
        <span className="spinner" aria-hidden />
      </span>
    );
  }

  if (!temFoto) {
    return (
      <Escolher className="foto-slot add" label={`Adicionar foto ${rotulo}`} disabled={!podeEditar} onFile={onEnviar}>
        <Camera />
      </Escolher>
    );
  }

  return (
    <>
      <button type="button" className="foto-slot thumb" aria-label={`Ver foto ${rotulo}`} onClick={() => setAberta(true)}>
        {url ? <img src={url} alt="" loading="lazy" /> : <Camera />}
      </button>
      {aberta && (
        <FotoViewer titulo={`Foto ${rotulo}`} url={url} onClose={() => setAberta(false)}>
          {podeEditar && (
            <Escolher
              className="btn"
              label="Trocar foto"
              disabled={ocupado}
              onFile={(f) => {
                setAberta(false);
                onEnviar(f);
              }}
            >
              Trocar foto
            </Escolher>
          )}
          <button
            type="button"
            className="btn danger"
            disabled={ocupado}
            onClick={() => {
              setAberta(false);
              onRemover();
            }}
          >
            Remover foto
          </button>
        </FotoViewer>
      )}
    </>
  );
}

/** Foto em tela cheia. Fecha no X, no Esc ou tocando fora. */
export function FotoViewer({ titulo, url, onClose, children }: { titulo: string; url?: string; onClose: () => void; children?: ReactNode }) {
  const fechar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    fechar.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="viewer-box">
        <div className="viewer-head">
          <strong>{titulo}</strong>
          <button ref={fechar} type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {url ? <img className="viewer-img" src={url} alt={titulo} /> : <p className="muted">Carregando a foto…</p>}
        {children && <div className="viewer-actions">{children}</div>}
      </div>
    </div>
  );
}

/** Miniatura só para ver (Histórico). */
export function FotoMini({ rotulo, url }: { rotulo: string; url?: string }) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" className="foto-slot thumb mini" aria-label={`Ver foto ${rotulo}`} onClick={() => setAberta(true)}>
        {url ? <img src={url} alt="" loading="lazy" /> : <Camera />}
      </button>
      {aberta && <FotoViewer titulo={`Foto ${rotulo}`} url={url} onClose={() => setAberta(false)} />}
    </>
  );
}
