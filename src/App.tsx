import { HashRouter, Route, Routes } from 'react-router-dom';

const Placeholder = ({ t }: { t: string }) => <h1>{t}</h1>;

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Placeholder t="Entrar" />} />
        <Route path="/" element={<Placeholder t="Hoje" />} />
        <Route path="/ranking" element={<Placeholder t="Ranking" />} />
        <Route path="/historico" element={<Placeholder t="Histórico" />} />
        <Route path="/peso" element={<Placeholder t="Peso" />} />
        <Route path="/config" element={<Placeholder t="Configurar desafio" />} />
      </Routes>
    </HashRouter>
  );
}
