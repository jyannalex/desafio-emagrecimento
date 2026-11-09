import { useState, type FormEvent } from 'react';
import { signIn, signUp } from '../data/auth';

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
      setErro('Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  function alternar(e: React.MouseEvent) {
    e.preventDefault();
    setCriar(!criar);
    setErro(null);
    setInfo(null);
  }

  return (
    <main className="page">
      <h1>💪 Desafio</h1>
      <form className="card" onSubmit={submit}>
        <h2>{criar ? 'Nova conta' : 'Entrar na conta'}</h2>
        {criar && (
          <label className="field">
            <span>Nome</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="nickname" />
          </label>
        )}
        <label className="field">
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
            autoComplete={criar ? 'new-password' : 'current-password'}
          />
        </label>
        {erro && <p className="error">{erro}</p>}
        {info && <p className="muted">{info}</p>}
        <button className="primary" type="submit" disabled={enviando} style={{ width: '100%' }}>
          {criar ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      <p className="muted" style={{ textAlign: 'center' }}>
        {criar ? 'Já tem conta? ' : 'Primeira vez? '}
        <a href="#" onClick={alternar}>
          {criar ? 'Fazer login' : 'Criar uma conta'}
        </a>
      </p>
    </main>
  );
}
