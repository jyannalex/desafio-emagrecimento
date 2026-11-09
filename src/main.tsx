import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { supabase } from './lib/supabase';
import './styles.css';

function ConfigAusente() {
  return (
    <main className="page">
      <h1>Configuração ausente</h1>
      <p>Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{supabase ? <App /> : <ConfigAusente />}</React.StrictMode>,
);
