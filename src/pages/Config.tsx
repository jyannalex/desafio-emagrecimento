import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../data/auth';
import { useApp } from '../data/AppContext';
import { getProfiles, saveChallenge, updateProfile } from '../data/repo';

export default function Config() {
  const { userId, challenge, reloadChallenge } = useApp();
  const navigate = useNavigate();

  const [nomeDesafio, setNomeDesafio] = useState(challenge?.nome ?? 'Nosso desafio');
  const [inicio, setInicio] = useState(challenge?.data_inicio ?? '');
  const [fim, setFim] = useState(challenge?.data_fim ?? '');
  const [msgDesafio, setMsgDesafio] = useState<{ erro: boolean; texto: string } | null>(null);
  const [salvandoDesafio, setSalvandoDesafio] = useState(false);

  const [nome, setNome] = useState('');
  const [meta, setMeta] = useState('');
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [msgPerfil, setMsgPerfil] = useState<{ erro: boolean; texto: string } | null>(null);

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

  const Msg = ({ m }: { m: { erro: boolean; texto: string } | null }) =>
    m && <p className={m.erro ? 'error' : 'muted'}>{m.texto}</p>;

  return (
    <main className="page">
      <h1>{challenge ? 'Configurações' : 'Configurar desafio'}</h1>

      <form className="card" onSubmit={salvarDesafio} noValidate>
        <h2>🏁 Desafio</h2>
        {!challenge && <p className="muted">Defina o nome e o período. Os dois usam o mesmo desafio.</p>}
        <label className="field">
          <span>Nome do desafio</span>
          <input type="text" value={nomeDesafio} onChange={(e) => setNomeDesafio(e.target.value)} maxLength={60} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>Início</span>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="field grow">
            <span>Fim</span>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
        </div>
        <Msg m={msgDesafio} />
        <button className="primary" type="submit" disabled={salvandoDesafio} style={{ width: '100%' }}>
          Salvar desafio
        </button>
      </form>

      <form className="card" onSubmit={salvarPerfil} noValidate>
        <h2>🙂 Meu perfil</h2>
        <label className="field">
          <span>Meu nome</span>
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={40} />
        </label>
        <label className="field">
          <span>Meta de água (ml)</span>
          <input type="number" inputMode="numeric" min={1} step={250} value={meta} onChange={(e) => setMeta(e.target.value)} />
        </label>
        <p className="muted" style={{ marginTop: -6 }}>Vale a partir do próximo dia registrado; dias já registrados mantêm a meta antiga.</p>
        <Msg m={msgPerfil} />
        <button type="submit" disabled={!perfilCarregado} style={{ width: '100%' }}>
          Salvar perfil
        </button>
      </form>

      <button onClick={() => signOut()} style={{ width: '100%' }}>
        Sair
      </button>
    </main>
  );
}
