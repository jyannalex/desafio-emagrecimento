import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../data/auth';
import { useApp } from '../data/AppContext';
import { getProfiles, saveChallenge, updateProfile } from '../data/repo';
import { getThemePref, setThemePref, type ThemePref } from '../lib/theme';

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

  useEffect(() => {
    getProfiles()
      .then((ps) => {
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
