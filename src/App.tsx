import { useCallback, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './data/auth';
import { getChallenge } from './data/repo';
import { AppCtx } from './data/AppContext';
import type { Challenge } from './types';
import NavBar from './components/NavBar';
import { ToastProvider } from './components/Toast';
import Login from './pages/Login';
import Hoje from './pages/Hoje';

const Placeholder = ({ t }: { t: string }) => (
  <main className="page">
    <h1>{t}</h1>
  </main>
);

const Carregando = () => (
  <main className="page">
    <p className="muted">Carregando…</p>
  </main>
);

function Shell() {
  const { session, loading } = useSession();
  const userId = session?.user.id;
  const [challenge, setChallenge] = useState<Challenge | null | undefined>(undefined);
  const [erro, setErro] = useState(false);

  const reloadChallenge = useCallback(async () => {
    setErro(false);
    try {
      setChallenge(await getChallenge());
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    if (userId) reloadChallenge();
    else setChallenge(undefined);
  }, [userId, reloadChallenge]);

  if (loading) return <Carregando />;
  if (!userId) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  if (erro) {
    return (
      <main className="page">
        <p className="error">Não foi possível carregar o desafio.</p>
        <button onClick={reloadChallenge}>Tentar de novo</button>
      </main>
    );
  }
  if (challenge === undefined) return <Carregando />;

  return (
    <AppCtx.Provider value={{ userId, challenge, reloadChallenge }}>
      {challenge === null ? (
        <Routes>
          <Route path="/config" element={<Placeholder t="Configurar desafio" />} />
          <Route path="*" element={<Navigate to="/config" replace />} />
        </Routes>
      ) : (
        <>
          <Routes>
            <Route path="/" element={<Hoje />} />
            <Route path="/ranking" element={<Placeholder t="Ranking" />} />
            <Route path="/historico" element={<Placeholder t="Histórico" />} />
            <Route path="/peso" element={<Placeholder t="Peso" />} />
            <Route path="/config" element={<Placeholder t="Configurações" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <NavBar />
        </>
      )}
    </AppCtx.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ToastProvider>
  );
}
