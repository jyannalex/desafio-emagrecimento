# Desafio de Emagrecimento — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA para 2 pessoas registrarem refeições na dieta, atividade, água e peso, com pontuação diária (0–6) e ranking de um desafio com início e fim.

**Architecture:** SPA React + TS (Vite) falando direto com o Supabase (Auth + Postgres + RLS). A lógica de pontos e de datas fica em módulos puros testados com Vitest. As telas só exibem e gravam. O deploy é estático no GitHub Pages via Actions.

**Tech Stack:** Vite 5, React 18, TypeScript 5, react-router-dom 6 (`HashRouter`), @supabase/supabase-js 2, recharts 2, Vitest 2 + @testing-library/react, vite-plugin-pwa, Supabase CLI (migrações).

**Spec:** `docs/superpowers/specs/2026-11-08-desafio-emagrecimento-design.md`

## Global Constraints

- Fuso de todas as regras de data: `America/Sao_Paulo`. Datas trafegam como string `YYYY-MM-DD`.
- Máximo de **6 pontos/dia**: cafe, almoco, lanche, jantar, atividade (✅) e água (`agua_ml >= meta_agua_ml_do_dia`).
- Ponto da atividade vem do ✅, nunca de `atividade_min`.
- Edição de `daily_logs`: só **hoje ou ontem**, dentro de `data_inicio..data_fim` (inclusivo). Garantido no RLS **e** na UI.
- Meta de água padrão: **2000** ml. Botões de água: **+250**, **+500**, **−250** (nunca abaixo de 0).
- Semana = segunda a domingo. Aproveitamento = pontos ÷ (6 × dias decorridos, contando hoje).
- Textos de UI em português. Mensagens fixas: "Não salvou, tente de novo", "Esse dia já fechou", "Empate".
- Chave anon só via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Nenhum segredo no repositório.
- Roteamento com `HashRouter`. `base` do Vite = `/desafio-emagrecimento/`.
- Fora de escopo: offline, fotos, notificações, contestação, >2 pessoas, calorias.

## Review Focus

1. **Virada de dia em São Paulo:** às 23:30 BRT (02:30 UTC do dia seguinte), "hoje" ainda é o dia BRT. Teste em `dates.test.ts` (Task 2).
2. **Semana que cruza o início ou o fim do desafio:** os pontos e o aproveitamento contam só os dias dentro do período. Teste em `scoring.test.ts` (Task 3).
3. **Desafio ainda não começou** (hoje < `data_inicio`): totais 0, aproveitamento 0 (sem divisão por zero) e o ranking mostra "começa em N dias". Testes em Task 3 e Task 7.
4. **Toques rápidos na água:** vários +250 seguidos não podem perder incremento por corrida entre gravações otimistas. As gravações são serializadas por fila no hook. Teste em `useDailyLog.test.ts` (Task 6).
5. **Primeiro registro do dia criado por toque em "−250" ou por nota:** o upsert precisa preencher `meta_agua_ml_do_dia` com a meta atual e `agua_ml` não fica negativo. Teste em Task 6.

---

## Estrutura de arquivos

```
.github/workflows/deploy.yml
supabase/migrations/0001_init.sql
supabase/tests/rls_test.sql
src/main.tsx                 # monta <App/>, checa env
src/App.tsx                  # HashRouter, rotas, guarda de sessão e de desafio
src/types.ts                 # Profile, Challenge, DailyLog, Weight
src/lib/dates.ts             # puro
src/lib/scoring.ts           # puro
src/lib/supabase.ts          # cliente + checagem de env
src/data/auth.ts             # signIn/signUp/signOut/useSession
src/data/repo.ts             # leitura/gravação nas 4 tabelas
src/hooks/useDailyLog.ts     # estado otimista + fila de gravação
src/pages/Login.tsx
src/pages/Hoje.tsx
src/pages/Ranking.tsx
src/pages/Historico.tsx
src/pages/Peso.tsx
src/pages/Config.tsx
src/components/NavBar.tsx
src/components/Toast.tsx
src/styles.css
tests/... (ao lado: *.test.ts(x) em src/)
README.md
```

---

### Task 1: Scaffold do projeto e casca do app

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `.env.example`, `src/main.tsx`, `src/App.tsx`, `src/lib/supabase.ts`, `src/types.ts`, `src/styles.css`
- Test: `src/lib/supabase.test.ts`

**Interfaces:**
- Produces:
  - `src/types.ts`:
    ```ts
    export type Profile = { id: string; nome: string; meta_agua_ml: number };
    export type Challenge = { id: 1; nome: string; data_inicio: string; data_fim: string };
    export type DailyLog = {
      user_id: string; dia: string;
      cafe: boolean; almoco: boolean; lanche: boolean; jantar: boolean;
      nota_cafe: string | null; nota_almoco: string | null; nota_lanche: string | null; nota_jantar: string | null;
      atividade: boolean; atividade_min: number;
      agua_ml: number; meta_agua_ml_do_dia: number;
    };
    export type Weight = { id: number; user_id: string; dia: string; kg: number };
    ```
  - `src/lib/supabase.ts`: `readEnv(env: Record<string, string | undefined>): { url: string; anonKey: string } | null` e `export const supabase: SupabaseClient | null`
- Scripts npm: `dev`, `build`, `test` (`vitest run`), `preview`.

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`, depois instale `@supabase/supabase-js react-router-dom recharts` e, como dev, `vitest @testing-library/react @testing-library/jest-dom jsdom vite-plugin-pwa`. Em `vite.config.ts`, defina `base: '/desafio-emagrecimento/'` e `test.environment: 'jsdom'`.
- [ ] **Step 2: Write the failing test** `src/lib/supabase.test.ts`
  ```ts
  test('readEnv retorna null sem variáveis', () => {
    expect(readEnv({})).toBeNull();
    expect(readEnv({ VITE_SUPABASE_URL: 'x' })).toBeNull();
  });
  test('readEnv retorna config completa', () => {
    expect(readEnv({ VITE_SUPABASE_URL: 'https://a.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }))
      .toEqual({ url: 'https://a.supabase.co', anonKey: 'k' });
  });
  ```
- [ ] **Step 3:** `npm test`. Expected: FAIL (readEnv não existe).
- [ ] **Step 4:** Implemente `readEnv` e `supabase` (null quando `readEnv(import.meta.env)` for null). `App.tsx` com `HashRouter` e rotas `/login`, `/`, `/ranking`, `/historico`, `/peso`, `/config` usando placeholders. Quando `supabase === null`, `main.tsx` renderiza a tela "Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY". `.env.example` traz as duas chaves vazias e `.env` fica no `.gitignore`.
- [ ] **Step 5:** `npm test && npm run build`. Expected: PASS, build sem erros.
- [ ] **Step 6:** Commit `chore: scaffold vite react ts + casca do app`.

---

### Task 2: `dates.ts` — datas no fuso de São Paulo

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces (todas puras, datas `YYYY-MM-DD`):
  - `todayBR(now?: Date): string` — usa `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })`
  - `addDays(day: string, n: number): string`
  - `weekStart(day: string): string` — segunda-feira da semana de `day`
  - `daysInclusive(from: string, to: string): number` — 0 se `to < from`
  - `isEditable(day: string, today: string, ch: Pick<Challenge,'data_inicio'|'data_fim'>): boolean` — `day ∈ {today, today-1}` e `data_inicio ≤ day ≤ data_fim`

- [ ] **Step 1: Write the failing tests**
  ```ts
  test('todayBR respeita fuso', () => {
    expect(todayBR(new Date('2026-11-09T02:30:00Z'))).toBe('2026-11-08'); // 23:30 BRT
    expect(todayBR(new Date('2026-11-09T03:00:00Z'))).toBe('2026-11-09');
  });
  test('addDays atravessa mês/ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('weekStart é segunda', () => {
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // domingo
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // segunda
  });
  test('daysInclusive', () => {
    expect(daysInclusive('2026-11-01', '2026-11-01')).toBe(1);
    expect(daysInclusive('2026-11-01', '2026-11-10')).toBe(10);
    expect(daysInclusive('2026-11-10', '2026-11-01')).toBe(0);
  });
  test('isEditable', () => {
    const ch = { data_inicio: '2026-11-08', data_fim: '2027-02-05' };
    expect(isEditable('2026-11-10', '2026-11-10', ch)).toBe(true);
    expect(isEditable('2026-11-09', '2026-11-10', ch)).toBe(true);
    expect(isEditable('2026-11-08', '2026-11-10', ch)).toBe(false); // anteontem
    expect(isEditable('2026-11-07', '2026-11-08', ch)).toBe(false); // antes do início
    expect(isEditable('2027-02-06', '2027-02-06', ch)).toBe(false); // após o fim
  });
  ```
- [ ] **Step 2:** `npm test -- dates`. Expected: FAIL.
- [ ] **Step 3:** Implemente. Faça a aritmética de datas em UTC (`Date.UTC`) para não depender do fuso da máquina.
- [ ] **Step 4:** `npm test -- dates`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: utilitários de data no fuso de São Paulo`.

---

### Task 3: `scoring.ts` — pontos e ranking

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

**Interfaces:**
- Consumes: `addDays`, `weekStart`, `daysInclusive` (Task 2), `DailyLog`, `Challenge` (Task 1)
- Produces:
  - `MAX_POINTS = 6`
  - `dayPoints(log: Pick<DailyLog,'cafe'|'almoco'|'lanche'|'jantar'|'atividade'|'agua_ml'|'meta_agua_ml_do_dia'> | null | undefined): number`
  - `type Score = { points: number; days: number; pct: number }` — `pct` em 0..100, arredondado a inteiro; `days === 0` dá `pct = 0`
  - `scoreRange(logs: DailyLog[], from: string, to: string): Score` — soma `dayPoints` dos logs com `from ≤ dia ≤ to`; `days = daysInclusive(from,to)`
  - `type Standing = { total: Score; week: Score; today: Score; status: 'antes' | 'andamento' | 'encerrado'; diasRestantes: number }`
  - `standing(logs: DailyLog[], ch: Challenge, today: string): Standing` — total = início..min(hoje, fim); semana = max(weekStart(hoje), início)..min(hoje, fim); hoje = hoje..hoje se estiver no período, senão Score zero; `diasRestantes = daysInclusive(hoje+1, fim)` (0 se encerrado; se `antes`, `daysInclusive(hoje, início) - 1` = dias até começar)
  - `winner(a: { id: string; total: number }, b: { id: string; total: number }): string | 'empate'`

- [ ] **Step 1: Write the failing tests**
  ```ts
  const base = { cafe:false, almoco:false, lanche:false, jantar:false, atividade:false, agua_ml:0, meta_agua_ml_do_dia:2000 };
  const log = (dia: string, p: Partial<DailyLog>) => ({ ...base, user_id:'a', dia, nota_cafe:null, nota_almoco:null, nota_lanche:null, nota_jantar:null, atividade_min:0, ...p }) as DailyLog;
  const ch = { id: 1 as const, nome:'x', data_inicio:'2026-11-05', data_fim:'2026-11-20' };

  test('dayPoints', () => {
    expect(dayPoints(null)).toBe(0);
    expect(dayPoints(base)).toBe(0);
    expect(dayPoints({ ...base, cafe:true, almoco:true, lanche:true, jantar:true, atividade:true, agua_ml:2000 })).toBe(6);
    expect(dayPoints({ ...base, agua_ml:1999 })).toBe(0);
    expect(dayPoints({ ...base, atividade:true })).toBe(1);
  });
  test('meta de água usa a do dia', () => {
    expect(dayPoints({ ...base, agua_ml:2500, meta_agua_ml_do_dia:3000 })).toBe(0);
  });
  test('semana cruza o início do desafio', () => {
    // hoje = domingo 2026-11-08; semana 02..08, mas desafio começa 05
    const logs = [log('2026-11-04', { cafe:true }), log('2026-11-05', { cafe:true }), log('2026-11-08', { cafe:true, almoco:true })];
    const s = standing(logs, ch, '2026-11-08');
    expect(s.week).toEqual({ points: 3, days: 4, pct: 13 }); // 3/(6*4)=12.5 -> 13
    expect(s.total.points).toBe(3);
    expect(s.today.points).toBe(2);
    expect(s.status).toBe('andamento');
    expect(s.diasRestantes).toBe(12);
  });
  test('antes de começar: tudo zero, sem divisão por zero', () => {
    const s = standing([], ch, '2026-11-01');
    expect(s.total).toEqual({ points:0, days:0, pct:0 });
    expect(s.status).toBe('antes');
    expect(s.diasRestantes).toBe(4); // 01 -> 05
  });
  test('encerrado: total limitado ao fim', () => {
    const s = standing([log('2026-11-20', { cafe:true }), log('2026-11-21', { cafe:true })], ch, '2026-11-25');
    expect(s.total.points).toBe(1);
    expect(s.total.days).toBe(16);
    expect(s.status).toBe('encerrado');
    expect(s.diasRestantes).toBe(0);
  });
  test('winner', () => {
    expect(winner({ id:'a', total:10 }, { id:'b', total:9 })).toBe('a');
    expect(winner({ id:'a', total:9 }, { id:'b', total:9 })).toBe('empate');
  });
  ```
- [ ] **Step 2:** `npm test -- scoring`. Expected: FAIL.
- [ ] **Step 3:** Implemente. `standing` recebe só os logs de **uma** pessoa (quem chama filtra por `user_id`).
- [ ] **Step 4:** `npm test -- scoring`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: cálculo de pontos e ranking`.

---

### Task 4: Banco — migração e RLS

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `supabase/tests/rls_test.sql`, `supabase/config.toml` (via `npx supabase init`)

**Interfaces:**
- Produces: as tabelas `profiles`, `challenge`, `daily_logs` e `weights` exatamente como na seção 5 do spec, mais:
  - função `public.today_br() returns date` = `(now() at time zone 'America/Sao_Paulo')::date`
  - trigger `on_auth_user_created` em `auth.users`, que insere em `profiles (id, nome)` com `nome = coalesce(raw_user_meta_data->>'nome', split_part(email,'@',1))`
  - RLS habilitado em todas as tabelas, com as políticas da seção 5.1 do spec. Política de escrita do `daily_logs` (`INSERT with check` e `UPDATE using` + `with check`):
    ```sql
    user_id = auth.uid()
    and dia between public.today_br() - 1 and public.today_br()
    and exists (select 1 from challenge c where dia between c.data_inicio and c.data_fim)
    ```

- [ ] **Step 1: Write the failing test** `supabase/tests/rls_test.sql`. Dentro de uma transação com `rollback`, crie 2 usuários em `auth.users`, configure o `challenge` de `today_br()-10` a `today_br()+10` e simule o usuário A com `set local role authenticated; set local request.jwt.claims = '{"sub":"<A>"}'`. Asserções via `do $$ ... raise exception ... $$`:
  - A insere `daily_logs` de hoje e de ontem → OK
  - A insere `daily_logs` de `today_br()-2` → erro de RLS
  - A insere com `user_id = B` → erro de RLS
  - A faz update no registro de B → 0 linhas afetadas
  - A lê os `daily_logs` de B → 1+ linha
  - A insere `weights` de 30 dias atrás → OK
  - Ao final, `raise notice 'RLS OK'`
- [ ] **Step 2:** `npx supabase start` (Docker) e `npx supabase db reset`, depois `psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/tests/rls_test.sql`. Expected: FAIL (tabelas inexistentes).
- [ ] **Step 3:** Escreva `0001_init.sql`.
- [ ] **Step 4:** `npx supabase db reset` e rode o teste de novo. Expected: `NOTICE: RLS OK`.
- [ ] **Step 5:** Commit `feat: schema e RLS do supabase`.

> Sem Docker disponível: rode a migração e o teste no SQL Editor de um projeto Supabase de teste e registre a saída no commit.

---

### Task 5: Acesso a dados, login e guardas de rota

**Files:**
- Create: `src/data/auth.ts`, `src/data/repo.ts`, `src/pages/Login.tsx`, `src/components/NavBar.tsx`, `src/components/Toast.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 1), tipos (Task 1)
- Produces:
  - `auth.ts`: `useSession(): { session: Session | null; loading: boolean }`, `signIn(email, senha): Promise<string | null>` (mensagem de erro ou null), `signUp(email, senha, nome)`, `signOut()`
  - `repo.ts` (todas lançam `Error` em falha):
    - `getProfiles(): Promise<Profile[]>`, `updateProfile(id: string, p: Partial<Pick<Profile,'nome'|'meta_agua_ml'>>): Promise<void>`
    - `getChallenge(): Promise<Challenge | null>`, `saveChallenge(c: Omit<Challenge,'id'>): Promise<void>` (upsert id=1)
    - `getLogs(from?: string, to?: string): Promise<DailyLog[]>` (todas as pessoas)
    - `upsertLog(log: DailyLog): Promise<DailyLog>` (onConflict `user_id,dia`)
    - `getWeights(): Promise<Weight[]>`, `upsertWeight(w: Omit<Weight,'id'>): Promise<void>` (onConflict `user_id,dia`), `deleteWeight(id: number): Promise<void>`
  - `Toast`: `useToast(): (msg: string) => void` via contexto.
  - Guardas em `App.tsx`: sem sessão leva para `/login`; com sessão e `getChallenge()` nulo leva para `/config`.

- [ ] **Step 1: Write the failing test** `src/App.test.tsx` (mock de `./data/auth` e `./data/repo` com `vi.mock`):
  - sem sessão: renderiza o texto "Entrar"
  - com sessão e challenge nulo: renderiza "Configurar desafio"
  - com sessão e challenge: renderiza a NavBar com "Hoje", "Ranking", "Histórico", "Peso" e "Config"
- [ ] **Step 2:** `npm test -- App`. Expected: FAIL.
- [ ] **Step 3:** Implemente. O Login tem as abas Entrar/Criar conta (Criar conta pede nome) e mostra o erro retornado. Se `onAuthStateChange` informar sessão nula, o app volta para `/login`.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: login, repositório de dados e guardas de rota`.

---

### Task 6: Tela "Hoje" com gravação otimista

**Files:**
- Create: `src/hooks/useDailyLog.ts`, `src/pages/Hoje.tsx`
- Test: `src/hooks/useDailyLog.test.ts`, `src/pages/Hoje.test.tsx`

**Interfaces:**
- Consumes: `upsertLog`, `getLogs` (Task 5), `todayBR`, `addDays`, `isEditable` (Task 2), `dayPoints`, `MAX_POINTS` (Task 3), `useToast` (Task 5)
- Produces: `useDailyLog(userId: string, dia: string, metaAtual: number): { log: DailyLog; editable: boolean; update: (patch: Partial<DailyLog>) => void; addAgua: (delta: number) => void }`
  - Sem registro, `log` é o default (tudo false/0, notas null, `meta_agua_ml_do_dia = metaAtual`).
  - `update` e `addAgua` aplicam o novo estado na hora e entram numa **fila serial**: cada gravação espera a anterior e envia o estado mais recente. Em erro, o estado volta ao último confirmado pelo servidor e chama o toast "Não salvou, tente de novo".
  - `addAgua` faz `agua_ml = max(0, agua_ml + delta)`.
  - Com `editable === false`, `update`/`addAgua` não fazem nada.

- [ ] **Step 1: Write the failing tests** `useDailyLog.test.ts` (com `upsertLog` mockado):
  ```ts
  test('3 toques rápidos de +250 resultam em 750 gravado', async () => { /* addAgua(250) x3 sem await; último upsertLog recebe agua_ml 750 */ });
  test('primeiro toque −250 cria log com agua_ml 0 e meta atual', async () => { /* upsertLog recebe { agua_ml:0, meta_agua_ml_do_dia:2000 } */ });
  test('erro reverte e mostra toast', async () => { /* upsertLog rejeita -> log.cafe volta a false; toast('Não salvou, tente de novo') */ });
  test('dia não editável ignora update', () => { /* upsertLog não é chamado */ });
  ```
  `Hoje.test.tsx`: renderiza os 4 cartões de refeição, "Atividade", "Água", "0/6" e o seletor "Hoje"/"Ontem". Marcar "Café da manhã" muda para "1/6". Em dia não editável aparece "Esse dia já fechou" e os checkboxes ficam `disabled`.
- [ ] **Step 2:** `npm test -- useDailyLog Hoje`. Expected: FAIL.
- [ ] **Step 3:** Implemente. As notas gravam no `onBlur` e os minutos também no `onBlur`. A barra de água mostra `agua_ml / meta_agua_ml_do_dia`. O cabeçalho mostra `dayPoints(log)/6`.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tela Hoje com gravação otimista`.

---

### Task 7: Tela "Ranking"

**Files:**
- Create: `src/pages/Ranking.tsx`
- Test: `src/pages/Ranking.test.tsx`

**Interfaces:**
- Consumes: `getProfiles`, `getChallenge`, `getLogs` (Task 5), `standing`, `winner` (Task 3), `todayBR` (Task 2)

- [ ] **Step 1: Write the failing test** (repo mockado, `todayBR` mockado). Com 2 perfis e logs:
  - mostra os nomes lado a lado, com "Total", "Semana", "Hoje" e os valores `points` e `pct%` de cada um
  - em andamento: "Faltam 12 dias"
  - antes: "Começa em 3 dias"
  - encerrado com totais iguais: "Empate"; com totais diferentes: "🏆 <nome> venceu!"
- [ ] **Step 2:** `npm test -- Ranking`. Expected: FAIL.
- [ ] **Step 3:** Implemente. Filtre os logs por `user_id` antes de chamar `standing`. O líder do total ganha destaque visual.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tela de ranking`.

---

### Task 8: Tela "Histórico"

**Files:**
- Create: `src/pages/Historico.tsx`
- Test: `src/pages/Historico.test.tsx`

**Interfaces:**
- Consumes: `getProfiles`, `getChallenge`, `getLogs` (Task 5), `dayPoints` (Task 3), `addDays`, `todayBR` (Task 2)

- [ ] **Step 1: Write the failing test.** Lista os dias de `min(hoje, fim)` até `inicio`, do mais recente ao mais antigo, com "x/6" para cada pessoa (0/6 em dia sem registro). Ao clicar num dia, abre o detalhe com as refeições ✅/❌, as notas, os minutos de atividade e a água/meta de cada pessoa.
- [ ] **Step 2:** `npm test -- Historico`. Expected: FAIL.
- [ ] **Step 3:** Implemente (só leitura; para editar hoje/ontem, use a tela Hoje).
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tela de histórico`.

---

### Task 9: Tela "Peso"

**Files:**
- Create: `src/pages/Peso.tsx`
- Test: `src/pages/Peso.test.tsx`

**Interfaces:**
- Consumes: `getProfiles`, `getWeights`, `upsertWeight`, `deleteWeight` (Task 5), `todayBR` (Task 2)
- Produces: `weightDelta(ws: Weight[]): number | null` (exportada de `Peso.tsx`) — último kg − primeiro kg (ordenado por `dia`), arredondado a 0.1; null com menos de 2 pesagens

- [ ] **Step 1: Write the failing tests**
  ```ts
  test('weightDelta', () => {
    expect(weightDelta([])).toBeNull();
    expect(weightDelta([{ id:1, user_id:'a', dia:'2026-11-10', kg:80 }, { id:2, user_id:'a', dia:'2026-11-01', kg:82.36 }])).toBe(-2.4);
  });
  ```
  Teste de tela: o formulário (data padrão = hoje, kg) chama `upsertWeight` com o `user_id` da sessão. Kg inválido (vazio, ≤0, ≥400) mostra "Peso inválido" e não grava.
- [ ] **Step 2:** `npm test -- Peso`. Expected: FAIL.
- [ ] **Step 3:** Implemente. Gráfico `LineChart` do recharts com uma linha por pessoa (eixo X = dia) e, abaixo, a variação de cada um ("−2,4 kg"). A lista das próprias pesagens tem botão de excluir.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tela de peso`.

---

### Task 10: Tela "Configurações"

**Files:**
- Create: `src/pages/Config.tsx`
- Test: `src/pages/Config.test.tsx`

**Interfaces:**
- Consumes: `getProfiles`, `updateProfile`, `getChallenge`, `saveChallenge`, `signOut` (Task 5)

- [ ] **Step 1: Write the failing test.**
  - Sem challenge, o título é "Configurar desafio". Salvar com nome/início/fim válidos chama `saveChallenge` e redireciona para `/`.
  - Fim < início mostra "A data de fim deve ser depois do início" e não grava.
  - A meta de água aceita inteiro > 0; salvar chama `updateProfile(id, { meta_agua_ml })`.
  - O botão "Sair" chama `signOut`.
- [ ] **Step 2:** `npm test -- Config`. Expected: FAIL.
- [ ] **Step 3:** Implemente.
- [ ] **Step 4:** `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: tela de configurações`.

---

### Task 11: PWA, deploy e README

**Files:**
- Create: `.github/workflows/deploy.yml`, `public/icon-192.png`, `public/icon-512.png`, `README.md`
- Modify: `vite.config.ts`

- [ ] **Step 1:** Configure o `VitePWA` com `registerType: 'autoUpdate'`, manifest `name: 'Desafio'`, `short_name: 'Desafio'`, `display: 'standalone'`, `start_url: '/desafio-emagrecimento/'` e os dois ícones. Sem cache de dados (fora de escopo).
- [ ] **Step 2:** `deploy.yml`: em `push` na `main`, roda `npm ci`, `npm test` e `npm run build` com `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` vindos de `secrets`, depois `actions/upload-pages-artifact` (`dist`) e `actions/deploy-pages`.
- [ ] **Step 3:** O `README.md` traz:
  1. criar o projeto no Supabase e rodar `0001_init.sql` (SQL Editor ou `supabase db push`);
  2. copiar URL/anon key para `.env` e para os secrets do GitHub;
  3. em Settings → Pages, escolher Source = GitHub Actions;
  4. em Supabase Auth → Providers → Email, **desligar "Confirm email"** (opcional) e, depois que os dois se cadastrarem, **desligar "Allow new users to sign up"**;
  5. instalar no celular via "Adicionar à tela inicial";
  6. roteiro de teste manual: login, marcar tarefas, água +250 ×3, nota, Ontem, peso, ranking.
- [ ] **Step 4:** `npm test && npm run build`. Expected: PASS, `dist/manifest.webmanifest` gerado.
- [ ] **Step 5:** Commit `chore: PWA, deploy no GitHub Pages e README`.
