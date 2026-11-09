import { useState, type FormEvent } from 'react';
import { signIn, signUp } from '../data/auth';

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <i />
      <i />
    </span>
  );
}

export default function Login() {
  const [criar, setCriar] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setInfo(null);
    setEnviando(true);
    try {
      if (criar) {
        const r = await signUp(email.trim(), senha, nome.trim());
        if (r.error) setErro(r.error);
        if (r.info) setInfo(r.info);
      } else {
        const r = await signIn(email.trim(), senha);
        if (r) setErro(r);
      }
    } catch {
      setErro('Sem conexão. Confira a internet e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  function alternar() {
    setCriar(!criar);
    setErro(null);
    setInfo(null);
  }

  return (
    <main className="page login">
      <div className="brand">
        <BrandMark />
        <span className="display">Desafio</span>
      </div>
      <p className="lead">Vocês dois, um placar. Marque o dia e veja quem está na frente.</p>

      <form className="panel" onSubmit={submit}>
        <h2>{criar ? 'Criar sua conta' : 'Entrar'}</h2>
        {criar && (
          <label className="field">
            <span>Como quer ser chamado</span>
            <input className="input" type="text" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="nickname" />
          </label>
        )}
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            className="input"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
            autoComplete={criar ? 'new-password' : 'current-password'}
          />
        </label>
        {erro && <p className="form-msg error">{erro}</p>}
        {info && <p className="form-msg muted">{info}</p>}
        <button className="btn primary block" type="submit" disabled={enviando}>
          {criar ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      <p className="muted small" style={{ textAlign: 'center' }}>
        {criar ? 'Já tem conta?' : 'Primeira vez aqui?'}{' '}
        <button type="button" className="btn ghost" style={{ minHeight: 0, padding: 4, color: 'var(--ink)' }} onClick={alternar}>
          {criar ? 'Entrar' : 'Criar uma conta'}
        </button>
      </p>
    </main>
  );
}
