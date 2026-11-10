# Alimentos e calorias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar itens (alimento + gramas) em cada refeição, com kcal por refeição e por dia, catálogo TACO + alimentos cadastrados.

**Architecture:** Duas tabelas novas (`foods`, `meal_items`) com RLS; TACO carregada por migração gerada por script. O app baixa o catálogo inteiro uma vez e busca localmente (`src/lib/calorias.ts`). Componentes de UI em `src/components/Alimentos.tsx`, ligados a Hoje, Configurações e Histórico.

**Tech Stack:** React 18 + TS + Vite, Supabase (Postgres/RLS), Vitest + Testing Library, PGlite para RLS.

**Spec:** `docs/superpowers/specs/2026-11-10-alimentos-e-calorias-design.md`

## Global Constraints

- Calorias não mudam pontos, ranking nem o ✅ (MAX_POINTS continua 5).
- kcal do item = `round(gramas × kcal_100g / 100)`; total = soma dos itens já arredondados.
- Gramas: `> 0` e `<= 5000`. kcal/100 g: `0` a `900`. Nome do alimento: 2 a 80 caracteres (após trim).
- Refeições com itens: `cafe | almoco | lanche | jantar`.
- Item guarda cópia de `nome` e `kcal_100g`; `food_id` vira null se o alimento for apagado.
- Leites fora da fonte: `Leite integral` = 60, `Leite desnatado` = 35 (kcal/100 g).
- Textos da UI em português, sentence case; números em pt-BR (`1.430 kcal`).
- `vi.mock('../data/repo')` faz automock: todo teste de página que renderiza Hoje/Config/Histórico precisa de `mockResolvedValue` para as funções novas usadas ali.

## Review Focus

1. Busca com acento/maiúscula/ordem trocada ("FEIJAO carioca", "grelhado frango") encontra o alimento — teste na Task 3.
2. Gramas com vírgula ("120,5") vira 120.5, não NaN — teste na Task 5.
3. Apagar um alimento cadastrado que já foi usado mantém o item com nome e kcal — teste RLS na Task 2.
4. Dia que não pode editar (fora do desafio/futuro) mostra itens sem botões — teste na Task 6.
5. Falha ao salvar item volta a lista ao estado anterior e mostra o toast — teste na Task 5.

---

### Task 1: Seed da TACO (script gerador + nomes curtos)

**Files:**
- Create: `data/taco/food.csv`, `data/taco/nutrients.csv` (cópia de `raulfdm/taco-api/references/csv`, MIT) e `data/taco/LEIAME.md` (fonte e licença)
- Create: `data/taco/nomes-curtos.json` — `{ "<taco_id>": "Nome curto" }`, ~50 itens comuns (arroz, feijão, frango, carne, peixe, ovo, pães, leite/derivados, frutas, legumes, açúcar, café, óleo, manteiga, tapioca, cuscuz, batata, macarrão)
- Create: `scripts/taco-seed.mjs` (funções exportadas + CLI que escreve a migração)
- Create: `scripts/taco-seed.test.ts`
- Create (gerado): `supabase/migrations/0006_taco.sql`

**Interfaces:**
- Produces: `parseCsv(texto: string): string[][]` (aspas e vírgulas internas); `montarAlimentos(food, nutrients, nomesCurtos): {taco_id:number; nome:string; kcal_100g:number}[]`; `gerarSql(alimentos): string`. CLI: `node scripts/taco-seed.mjs` grava `0006_taco.sql`.
- O SQL insere `origem='taco'` com `on conflict (taco_id) do nothing`, e os dois leites como `origem='taco'` com `taco_id` 9001 e 9002.

- [ ] **Step 1: Teste** — `montarAlimentos` com CSV mínimo: alimento sem kcal fica de fora; nome curto substitui; aspas com vírgula preservadas (`"Arroz, tipo 1, cozido"`); `gerarSql` escapa `'` (ex.: `Pão d'água` → `Pão d''água`), contém `on conflict (taco_id) do nothing`, contém `(9001, 'Leite integral', 60` e `(9002, 'Leite desnatado', 35`; sobre os CSVs reais: 591 da fonte + 2 leites, sem `taco_id` repetido.
- [ ] **Step 2:** `npx vitest run scripts/taco-seed.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `scripts/taco-seed.mjs` e o JSON de nomes curtos (conferir cada id contra `food.csv`).
- [ ] **Step 4:** Teste → PASS. Rodar `node scripts/taco-seed.mjs`; conferir que `0006_taco.sql` tem 593 linhas de valores.
- [ ] **Step 5:** Commit `feat: seed da tabela TACO gerado por script`.

### Task 2: Migração 0005 (tabelas + RLS)

**Files:**
- Create: `supabase/migrations/0005_alimentos.sql`
- Modify: `supabase/tests/rls.test.ts` (carregar 0005 e 0006 no `beforeAll`)

**Interfaces:**
- Produces: tabelas `foods` e `meal_items` exatamente como spec §3.2; índice `meal_items(user_id, dia)`; policies spec §3.3. Update em `foods` usa `using/with check (origem='custom' and criado_por = auth.uid())` (impede trocar dono/origem). `grant` igual ao padrão de 0003.

- [ ] **Step 1: Testes RLS:**
  - `foods` tem 593 da TACO após 0006;
  - A não edita nem apaga alimento TACO (0 linhas afetadas);
  - A cadastra custom (`criado_por = A`), B lê, B não edita/apaga o de A, A edita e apaga o seu;
  - A não cadastra com `criado_por = B` nem `origem='taco'` (erro RLS);
  - kcal 901 e nome `' a '` falham por check;
  - A insere `meal_items` hoje; não insere para B; não insere amanhã; B lê o item de A; A edita gramas e apaga o seu; B não apaga o de A;
  - A cadastra alimento, usa num item, apaga o alimento → item fica com `food_id` null e mesmo `nome`/`kcal_100g`;
  - gramas 0 e 5001 falham; refeição `'ceia'` falha;
  - anon não lê `foods` nem `meal_items`.
- [ ] **Step 2:** `npx vitest run supabase/tests/rls.test.ts` → FAIL (arquivo 0005 não existe).
- [ ] **Step 3:** Escrever `0005_alimentos.sql`.
- [ ] **Step 4:** Testes → PASS (os antigos também).
- [ ] **Step 5:** Commit `feat: tabelas de alimentos e itens das refeições com RLS`.

### Task 3: `src/lib/calorias.ts`

**Files:** Create `src/lib/calorias.ts`, `src/lib/calorias.test.ts`; Modify `src/types.ts`.

**Interfaces:**
- Produces (types.ts): `Refeicao = 'cafe' | 'almoco' | 'lanche' | 'jantar'`; `Food = { id: number; nome: string; kcal_100g: number; origem: 'taco' | 'custom'; criado_por: string | null }`; `MealItem = { id: number; user_id: string; dia: string; refeicao: Refeicao; food_id: number | null; nome: string; kcal_100g: number; gramas: number }`.
- Produces (calorias.ts): `kcalItem(gramas: number, kcal100: number): number`; `somaKcal(itens: Pick<MealItem,'gramas'|'kcal_100g'>[]): number`; `normalizar(s: string): string`; `buscarAlimentos(catalogo: Food[], termo: string, recentes: number[]): Food[]`; `formatKcal(n: number): string` → `"1.430 kcal"`; `lerGramas(s: string): number | null` (aceita vírgula; null se vazio, ≤0, >5000 ou inválido); `kcalPor100(kcal: number, gramas: number): number` (1 casa decimal).

- [ ] **Step 1: Testes:**
  - `kcalItem(120, 128) === 154`; `somaKcal` de [120 g×128, 140 g×76] `=== 260` (154+106);
  - `normalizar('Feijão  CARIOCA') === 'feijao carioca'`;
  - busca `'grelhado frango'` acha `Peito de frango grelhado` e não acha `Frango cru`; `'FEIJAO'` acha `Feijão carioca cozido`;
  - termo vazio → recentes na ordem dada; com termo, recente que casa vem primeiro, depois quem começa com a 1ª palavra, depois nome mais curto; máximo 30;
  - `formatKcal(1430) === '1.430 kcal'`;
  - `lerGramas('120,5') === 120.5`, `lerGramas('0') === null`, `lerGramas('5001') === null`, `lerGramas('abc') === null`;
  - `kcalPor100(120, 30) === 400`.
- [ ] **Step 2:** `npx vitest run src/lib/calorias.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (`normalizar` com `normalize('NFD')` + remover `\p{Diacritic}`, colapsar espaços; `formatKcal` com `toLocaleString('pt-BR')`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: cálculo e busca de alimentos`.

### Task 4: Funções do repo

**Files:** Modify `src/data/repo.ts`; Create `src/data/repo.alimentos.test.ts` (mesmo Supabase falso de `repo.photos.test.ts`, acrescentando `insert`, `update`, `limit`, `not`).

**Interfaces:**
- Consumes: tipos da Task 3.
- Produces:
  - `getFoods(): Promise<Food[]>` — `select id,nome,kcal_100g,origem,criado_por`, paginando em blocos de 1000 (`range`) até acabar; resultado guardado em memória (segunda chamada não consulta); `limparCacheFoods()` exportado para testes.
  - `createFood(f: { nome: string; kcal_100g: number; criado_por: string }): Promise<Food>` (insert `origem:'custom'`, `.select().single()`; atualiza o cache).
  - `updateFood(id: number, f: { nome: string; kcal_100g: number }): Promise<Food>` (atualiza o cache).
  - `deleteFood(id: number): Promise<void>` (remove do cache).
  - `getMealItems(from: string, to: string, userId?: string): Promise<MealItem[]>` — ordenado por `created_at`.
  - `addMealItem(i: Omit<MealItem, 'id'>): Promise<MealItem>`.
  - `updateMealItemGramas(id: number, gramas: number): Promise<MealItem>`.
  - `deleteMealItem(id: number): Promise<void>`.
  - `recentFoodIds(userId: string): Promise<number[]>` — `food_id` dos últimos 200 itens da pessoa (`not food_id is null`, desc), sem repetir, até 8.

- [ ] **Step 1: Testes:** cache de `getFoods` (1 consulta em 2 chamadas) e paginação (1000 + 3 → 1003); `createFood` envia `origem:'custom'` e aparece no próximo `getFoods` sem nova consulta; `deleteFood` some do cache; `recentFoodIds` com `[5,3,5,null,7,…]` → `[5,3,7]` limitado a 8; erro do Supabase lança.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `npx tsc -b`.
- [ ] **Step 5:** Commit `feat: repo de alimentos e itens`.

### Task 5: Componentes de alimentos + hook

**Files:** Create `src/hooks/useAlimentos.ts`, `src/hooks/useItensDia.ts`, `src/components/Alimentos.tsx`, `src/components/Alimentos.test.tsx`; Modify `src/styles.css`.

**Interfaces:**
- Consumes: Tasks 3 e 4.
- Produces:
  - `useAlimentos(userId)` → `{ catalogo: Food[] | null; recentes: number[]; erro: boolean; recarregar(); cadastrar(nome, kcal, gramas): Promise<Food>; editar(id, nome, kcal100); apagar(id) }`.
  - `useItensDia(userId, dia)` → `{ itens: MealItem[]; carregado: boolean; adicionar(refeicao, food, gramas); mudarGramas(id, gramas); remover(id) }` — atualização otimista; em erro desfaz e mostra toast "Não foi salvo, tente de novo".
  - `<ItensRefeicao refeicao rotulo itens podeEditar onAdicionar onEditar />` — lista `nome · 120 g · 154 kcal`, subtotal, botão **+ Alimento** (aria-label `Adicionar alimento no {rotulo}`).
  - `<BuscaAlimento aberto userId onEscolher(food, gramas) onFechar />` — dialog `aria-label="Adicionar alimento"`: campo `Buscar alimento`; vazio → título **Usados recentemente**; resultados como botões; **Cadastrar "termo"**; depois de escolher, campo `Gramas` (`inputMode="decimal"`), texto `= N kcal`, botão **Adicionar** desabilitado se `lerGramas` for null.
  - `<EditarItem item onSalvar(gramas) onRemover onFechar />` — mesmo campo **Gramas**, **Salvar**, **Remover**.
  - `<FormAlimento inicial? onSalvar(nome, kcal, gramas) onCancelar />` — campos `Nome`, `Calorias (kcal)`, `Em quantos gramas` (padrão 100); botão **Salvar alimento**; dica "Copie da embalagem: as kcal e a porção em gramas".

- [ ] **Step 1: Testes (Testing Library, repo mockado):**
  - busca "arroz" → clica `Arroz branco cozido` → digita `120` → vê `= 154 kcal` → **Adicionar** chama `addMealItem` com `{ refeicao:'almoco', food_id, nome, kcal_100g:128, gramas:120 }`;
  - sem texto mostra recentes;
  - `120,5` é aceito; `0` desabilita **Adicionar**;
  - busca sem resultado → **Cadastrar "marmita da tia"** → form com nome preenchido, kcal 120 em 30 g → `createFood` com `kcal_100g:400` → volta ao campo de gramas do novo alimento;
  - editar item muda gramas; remover tira da lista;
  - `addMealItem` rejeitado → item some e toast aparece;
  - catálogo com erro → "Não foi possível carregar os alimentos" + **Tentar de novo**.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (reaproveitar o padrão de dialog de `FotoViewer`: Esc/fundo/**Fechar**). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: busca, cadastro e itens de alimentos`.

### Task 6: Tela Hoje

**Files:** Modify `src/pages/Hoje.tsx`, `src/pages/Hoje.test.tsx`.

**Interfaces:** Consumes Task 5. Em `Dia`, `useItensDia(userId, dia)`; cada refeição renderiza `<ItensRefeicao>` abaixo da linha nota/foto; cabeçalho mostra `formatKcal(somaKcal(itens))` + ` hoje` (ou só `N kcal` se o dia não for hoje) quando houver itens.

- [ ] **Step 1: Testes:** `beforeEach` mocka `getFoods`, `getMealItems` (`[]`), `recentFoodIds` (`[]`); com dois itens de almoço (154 e 106) mostra `260 kcal` no almoço e `260 kcal hoje` no topo; adicionar pelo fluxo atualiza o total; dia anterior ao desafio mostra itens sem **+ Alimento**; marcar/desmarcar itens não muda pontos (`0 de 5 pontos` com itens lançados).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS (suíte inteira de Hoje).
- [ ] **Step 5:** Commit `feat: itens e calorias na tela Hoje`.

### Task 7: Configurações → Meus alimentos

**Files:** Modify `src/pages/Config.tsx`, `src/pages/Config.test.tsx`.

**Interfaces:** Consumes `useAlimentos`, `FormAlimento`. Painel `<h2>Meus alimentos</h2>` (antes de "Minhas fotos"): lista `custom` com `criado_por === userId`, ordenada por nome (`nome · N kcal/100 g`), botões `Editar {nome}` / `Apagar {nome}` (com `window.confirm`), **Cadastrar alimento**; vazio → "Você ainda não cadastrou nenhum alimento".

- [ ] **Step 1: Testes:** mostra só os próprios (não os do outro nem TACO); cadastrar chama `createFood`; editar chama `updateFood`; apagar com confirmação chama `deleteFood` e some; vazio mostra o texto.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: meus alimentos nas configurações`.

### Task 8: Histórico

**Files:** Modify `src/pages/Historico.tsx`, `src/pages/Historico.test.tsx`.

**Interfaces:** ao abrir um dia, junto com as fotos carrega `getMealItems(aberto, aberto)`; `Detalhe` lista os itens sob cada refeição (`nome · 120 g · 154 kcal`) e mostra `Total: N kcal` quando houver itens.

- [ ] **Step 1: Testes:** abrir dia mostra itens de cada pessoa na refeição certa e o total; sem itens não mostra total.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: itens e calorias no histórico`.

### Task 9: Banco, docs e deploy

- [ ] Aplicar 0005 e 0006 no Supabase pelo script pg (senha só via env), `notify pgrst, 'reload schema'`; conferir `select count(*) from foods` = 593 e REST 200 em `foods`/`meal_items`.
- [ ] Atualizar o spec principal (remover "calorias" de fora de escopo, se houver, e apontar para o spec novo) e o README (migrações 0005/0006).
- [ ] `npm test`, `npx tsc -b`, `npm run build` verdes; push na main; conferir o deploy.
