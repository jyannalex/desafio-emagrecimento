import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../data/auth';
import { useApp } from '../data/AppContext';
import { deletePhotosUntil, getProfiles, myPhotoStats, saveChallenge, updateProfile } from '../data/repo';
import { useToday } from '../hooks/useToday';
import { CORES, playerColors, playerVar } from '../lib/players';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';
import type { CorId, Profile } from '../types';

type Msg = { erro: boolean; texto: string } | null;

const TEMAS: { v: ThemePref; label: string }[] = [
  { v: 'auto', label: 'Automático' },
  { v: 'light', label: 'Claro' },
  { v: 'dark', label: 'Escuro' },
];

function Aviso({ m }: { m: Msg }) {
  return m ? <p className={`form-msg ${m.erro ? 'error' : 'muted'}`}>{m.texto}</p> : null;
}

export default function Config() {
  const { userId, challenge, reloadChallenge } = useApp();
  const navigate = useNavigate();

  const [nomeDesafio, setNomeDesafio] = useState(challenge?.nome ?? 'Nosso desafio');
  const [inicio, setInicio] = useState(challenge?.data_inicio ?? '');
  const [fim, setFim] = useState(challenge?.data_fim ?? '');
  const [msgDesafio, setMsgDesafio] = useState<Msg>(null);
  const [salvandoDesafio, setSalvandoDesafio] = useState(false);

  const [nome, setNome] = useState('');
  const [meta, setMeta] = useState('');
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [msgPerfil, setMsgPerfil] = useState<Msg>(null);

  const [tema, setTema] = useState<ThemePref>(getThemePref);

  const [perfis, setPerfis] = useState<Profile[]>([]);
  const [msgCor, setMsgCor] = useState<Msg>(null);

  const today = useToday();
  const [fotos, setFotos] = useState<{ count: number; bytes: number } | null>(null);
  const [ateDia, setAteDia] = useState(today);
  const [apagando, setApagando] = useState(false);
  const [msgFotos, setMsgFotos] = useState<Msg>(null);

  function carregarFotos() {
    myPhotoStats(userId)
      .then(setFotos)
      .catch(() => setMsgFotos({ erro: true, texto: 'Não foi possível ver suas fotos' }));
  }

  useEffect(() => {
    if (challenge) carregarFotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, !!challenge]);

  useEffect(() => {
    getProfiles()
      .then((ps) => {
        setPerfis(ps);
        const eu = ps.find((p) => p.id === userId);
        if (eu) {
          setNome(eu.nome);
          setMeta(String(eu.meta_agua_ml));
        }
        setPerfilCarregado(true);
      })
      .catch(() => setMsgPerfil({ erro: true, texto: 'Não foi possível carregar seu perfil' }));
  }, [userId]);

  function escolherTema(t: ThemePref) {
    setTema(t);
    setThemePref(t);
  }

  const cores = playerColors(perfis);
  const minhaCor = cores.get(userId);
  const outro = perfis.find((p) => p.id !== userId);
  const corDoOutro = outro ? cores.get(outro.id) : undefined;

  async function escolherCor(cor: CorId) {
    const antes = perfis;
    setMsgCor(null);
    setPerfis((ps) => ps.map((p) => (p.id === userId ? { ...p, cor } : p)));
    try {
      await updateProfile(userId, { cor });
    } catch {
      setPerfis(antes);
      setMsgCor({ erro: true, texto: 'Não salvou, tente de novo' });
    }
  }

  async function apagarFotos() {
    if (!ateDia) return;
    if (!window.confirm('Apagar todas as suas fotos até ' + ateDia.split('-').reverse().join('/') + '? Não dá para desfazer.')) return;
    setApagando(true);
    setMsgFotos(null);
    try {
      const n = await deletePhotosUntil(userId, ateDia);
      setMsgFotos({ erro: false, texto: n === 1 ? '1 foto apagada' : n + ' fotos apagadas' });
      carregarFotos();
    } catch {
      setMsgFotos({ erro: true, texto: 'Não apagou, tente de novo' });
    } finally {
      setApagando(false);
    }
  }

  async function salvarDesafio(e: FormEvent) {
    e.preventDefault();
    setMsgDesafio(null);
    if (!nomeDesafio.trim() || !inicio || !fim) {
      setMsgDesafio({ erro: true, texto: 'Preencha nome, início e fim' });
      return;
    }
    if (fim < inicio) {
      setMsgDesafio({ erro: true, texto: 'A data de fim deve ser depois do início' });
      return;
    }
    setSalvandoDesafio(true);
    try {
      const novo = challenge === null;
      await saveChallenge({ nome: nomeDesafio.trim(), data_inicio: inicio, data_fim: fim });
      await reloadChallenge();
      if (novo) navigate('/', { replace: true });
      else setMsgDesafio({ erro: false, texto: 'Desafio salvo' });
    } catch {
      setMsgDesafio({ erro: true, texto: 'Não salvou, tente de novo' });
    } finally {
      setSalvandoDesafio(false);
    }
  }

  async function salvarPerfil(e: FormEvent) {
    e.preventDefault();
    setMsgPerfil(null);
    const n = Math.floor(Number(meta));
    if (!meta.trim() || !Number.isFinite(n) || n <= 0) {
      setMsgPerfil({ erro: true, texto: 'A meta de água deve ser maior que zero' });
      return;
    }
    if (!nome.trim()) {
      setMsgPerfil({ erro: true, texto: 'Informe seu nome' });
      return;
    }
    try {
      await updateProfile(userId, { nome: nome.trim(), meta_agua_ml: n });
      setMsgPerfil({ erro: false, texto: 'Perfil salvo' });
    } catch {
      setMsgPerfil({ erro: true, texto: 'Não salvou, tente de novo' });
    }
  }

  return (
    <main className="page">
      <h1>{challenge ? 'Configurações' : 'Configurar desafio'}</h1>
      <p className="muted" style={{ margin: '0 0 18px' }}>
        {challenge ? 'Ajuste o desafio, seu perfil e a aparência.' : 'Escolha o nome e o período. Vale para vocês dois.'}
      </p>

      <form className="panel" onSubmit={salvarDesafio} noValidate>
        <h2>Desafio</h2>
        <label className="field">
          <span>Nome do desafio</span>
          <input className="input" type="text" value={nomeDesafio} onChange={(e) => setNomeDesafio(e.target.value)} maxLength={60} />
        </label>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <label className="field grow">
            <span>Início</span>
            <input className="input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="field grow">
            <span>Fim</span>
            <input className="input" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>
        <Aviso m={msgDesafio} />
        <button className="btn primary block" type="submit" disabled={salvandoDesafio}>
          Salvar desafio
        </button>
      </form>

      {challenge && (
        <form className="panel" onSubmit={salvarPerfil} noValidate>
          <h2>Meu perfil</h2>
          <label className="field">
            <span>Meu nome</span>
            <input className="input" type="text" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
          </label>
          <label className="field">
            <span>Meta de água (ml)</span>
            <input className="input" type="number" inputMode="numeric" min={1} step={250} value={meta} onChange={(e) => setMeta(e.target.value)} />
          </label>
          <p className="muted small" style={{ marginTop: -6 }}>
            A nova meta vale a partir do próximo dia registrado. Dias já registrados mantêm a meta antiga.
          </p>
          <Aviso m={msgPerfil} />
          <button className="btn block" type="submit" disabled={!perfilCarregado}>
            Salvar perfil
          </button>
        </form>
      )}

      {challenge && (
        <section className="panel">
          <h2>Minha cor</h2>
          <div className="swatches" role="group" aria-label="Minha cor">
            {CORES.map((c) => {
              const doOutro = c.id === corDoOutro;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="swatch"
                  style={{ '--sw': playerVar(c.id) } as CSSProperties}
                  aria-pressed={minhaCor === c.id}
                  aria-label={doOutro ? c.nome + ' (cor de ' + outro!.nome + ')' : c.nome}
                  disabled={doOutro || !perfilCarregado}
                  onClick={() => escolherCor(c.id)}
                >
                  <i aria-hidden />
                  <span>{c.nome}</span>
                </button>
              );
            })}
          </div>
          <Aviso m={msgCor} />
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Aparece no ranking, no histórico e no gráfico de peso. A cor de quem está com você fica bloqueada.
          </p>
        </section>
      )}

      {challenge && (
        <section className="panel">
          <h2>Minhas fotos</h2>
          <p style={{ margin: '0 0 12px' }}>
            {fotos === null ? 'Carregando…' : fotos.count === 0 ? 'Nenhuma foto sua guardada' : fmtFotos(fotos)}
          </p>
          <label className="field">
            <span>Apagar fotos até o dia</span>
            <input className="input" type="date" value={ateDia} max={today} onChange={(e) => setAteDia(e.target.value)} />
          </label>
          <Aviso m={msgFotos} />
          <button className="btn danger block" type="button" disabled={apagando || !fotos || fotos.count === 0} onClick={apagarFotos}>
            Apagar minhas fotos
          </button>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Apaga só as suas fotos, do início do desafio até o dia escolhido. Os registros e pontos continuam.
          </p>
        </section>
      )}

      <section className="panel">
        <h2>Aparência</h2>
        <div className="seg full" role="group" aria-label="Tema">
          {TEMAS.map((t) => (
            <button key={t.v} type="button" aria-pressed={tema === t.v} onClick={() => escolherTema(t.v)}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          Automático segue o tema do celular.
        </p>
      </section>

      <button className="btn ghost block" onClick={() => signOut()}>
        Sair
      </button>
    </main>
  );
}

function fmtFotos(f: { count: number; bytes: number }) {
  const mb = (f.bytes / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (f.count === 1 ? '1 foto' : f.count + ' fotos') + ', ' + mb + ' MB';
}
