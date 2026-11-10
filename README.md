# 💪 Desafio de Emagrecimento

App para duas pessoas registrarem o dia (refeições na dieta, atividade física e água), somarem pontos e acompanharem o ranking de um desafio com início e fim. O peso fica registrado só para acompanhamento.

**Pontos por dia (máx. 6):** café, almoço, lanche e jantar na dieta (✅), atividade física (✅) e meta de água batida.

Stack: React + TypeScript + Vite · Supabase (login, Postgres, RLS) · GitHub Pages · PWA.

---

## Colocar no ar (uma vez)

### 1. Supabase
1. Crie um projeto em <https://supabase.com/dashboard>.
2. Abra **SQL Editor** e rode, em ordem, cada arquivo de [`supabase/migrations/`](supabase/migrations/) (`0001` a `0006`; o `0006_taco.sql` carrega os ~600 alimentos da tabela TACO e é gerado por `node scripts/taco-seed.mjs`).
3. Em **Authentication → Sign In / Providers → Email**:
   - deixe **Email** ligado;
   - (opcional) desligue **Confirm email** para entrar sem precisar confirmar o e-mail.
4. Em **Authentication → URL Configuration**, coloque em **Site URL** o endereço do site
   (`https://<seu-usuario>.github.io/desafio-emagrecimento/`) e adicione o mesmo em **Redirect URLs**.
   Sem isso, o link de confirmação do e-mail abre `localhost`.
5. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.

### 2. GitHub
1. Crie um repositório chamado **`desafio-emagrecimento`** e envie este código:
   ```bash
   git remote add origin https://github.com/<seu-usuario>/desafio-emagrecimento.git
   git push -u origin main
   ```
   Se o repositório tiver outro nome, troque `base` em [`vite.config.ts`](vite.config.ts).
2. Em **Settings → Secrets and variables → Actions → New repository secret**, crie:
   - `VITE_SUPABASE_URL`: a Project URL
   - `VITE_SUPABASE_ANON_KEY`: a chave anon public
3. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
4. Rode o workflow **Deploy** (aba **Actions**) ou faça um push na `main`. O site fica em
   `https://<seu-usuario>.github.io/desafio-emagrecimento/`.

### 3. Contas
1. Os dois abrem o site e usam **Criar uma conta**.
2. Um de vocês configura o desafio (nome, início e fim). A tela aparece sozinha no primeiro acesso.
3. **Depois que os dois tiverem conta:** no Supabase, em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**. Ninguém mais consegue se cadastrar.

### 4. No celular
- **Android (Chrome):** menu ⋮ → **Adicionar à tela inicial / Instalar app**.
- **iPhone (Safari):** botão Compartilhar → **Adicionar à Tela de Início**.

---

## Regras
- Cada um só altera os próprios registros e vê os do outro.
- Dá para marcar ou corrigir **hoje e ontem**. Dias mais antigos ficam travados, e o próprio banco recusa a alteração.
- A meta de água vale para os dias registrados a partir da mudança. Dias que já têm registro guardam a meta da época.
- Ranking: total, semana (segunda a domingo) e hoje, com % de aproveitamento (pontos ÷ 6 × dias decorridos).

## Desenvolvimento
```bash
cp .env.example .env   # preencha URL e anon key
npm install
npm run dev            # http://localhost:5173/desafio-emagrecimento/
npm test               # unitários + telas + RLS (PGlite, sem Docker)
npm run build
```

## Roteiro de teste manual (antes de liberar)
1. Criar as duas contas e entrar.
2. Configurar o desafio começando hoje.
3. Em **Hoje**: marcar café, escrever uma nota no almoço, marcar atividade com 30 min, tocar **+250** três vezes rápido e conferir **750 ml**.
4. Trocar para **Ontem**: aparece "Fora do período do desafio" se o desafio começou hoje.
5. **Peso**: lançar um peso e conferir o gráfico.
6. **Ranking**: pontos de hoje iguais aos da tela Hoje; entrar com a outra conta e ver os dois.
7. **Histórico**: abrir o dia e ver a nota do almoço.
8. Instalar na tela inicial e abrir pelo ícone.
