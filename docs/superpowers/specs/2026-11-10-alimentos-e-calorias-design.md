# Alimentos e calorias — Design

Data: 2026-11-10. Complementa `2026-11-08-desafio-emagrecimento-design.md`.

## 1. Objetivo

Registrar o que foi comido em cada refeição, em gramas, e ver as calorias por refeição e do dia.
O app já vem com os alimentos da tabela TACO, e cada um pode cadastrar o que faltar.

**Calorias são só informação.** Não mudam pontos nem ranking.

**Atualizado em 2026-11-10 (pedido do usuário):** a refeição só pode ser marcada com pelo menos um alimento.
Tocar no ✅ de uma refeição sem alimento abre a busca, e o ✅ só é marcado depois que o alimento é gravado; fechar a busca deixa desmarcado.
Com alimento, o ✅ marca e desmarca normalmente (desmarcar = fugiu da dieta). Adicionar pelo "+ Alimento" não marca sozinho.
O campo "anotar o que comeu" saiu da tela Hoje (anotações antigas continuam no Histórico).
Busca sem resultado já mostra o formulário de cadastro; com resultados, "Não achou? Cadastrar" fica antes da lista.

## 2. Regras

- **Atualizado (0008):** alimento cadastrado pode ser **por grama** (kcal em 100 g) ou **por unidade** (kcal de 1 unidade), nunca os dois. Item de alimento por unidade guarda `unidades` (0,1 a 100) + `kcal_unidade`; kcal = round(unidades × kcal_unidade). TACO continua por grama.

- Quantidade sempre em **gramas**, digitada (ex.: 120). Sem medidas caseiras. Líquidos: 1 ml ≈ 1 g.
- kcal do item = `round(gramas × kcal_100g / 100)`. Total da refeição e do dia = soma dos itens (sem arredondar de novo).
- Refeições com itens: café, almoço, lanche e jantar (o lanche continua sem ponto, mas tem calorias normalmente).
- Mesmo alimento pode entrar mais de uma vez na mesma refeição.
- Quem pode registrar/editar/apagar itens: a própria pessoa, nos mesmos dias em que ela pode editar o registro (`can_write_log`: dia do desafio até hoje). Os dois veem os itens um do outro.
- **Catálogo compartilhado:** alimentos da TACO são só leitura. Alimentos cadastrados aparecem para os dois; só quem cadastrou edita ou apaga.
- **Cópia no item:** cada item guarda o nome e as kcal/100 g do momento do registro. Editar ou apagar um alimento depois não muda o que já foi registrado.

## 3. Dados

### 3.1 Base TACO

Fonte: `references/csv/food.csv` e `nutrients.csv` do repositório `raulfdm/taco-api` (MIT), que transcreve a TACO 4ª ed. (NEPA/UNICAMP). 597 alimentos; usa-se a coluna `kcal`.

- Os 6 sem kcal na fonte ficam de fora, exceto os dois leites, que entram com o valor típico de embalagem e o nome deixando isso claro:
  `Leite integral` = 60 kcal/100 g e `Leite desnatado` = 35 kcal/100 g.
- Cerca de 50 alimentos mais comuns ganham nome curto (ex.: `Arroz, tipo 1, cozido` → `Arroz branco cozido`; `Frango, peito, sem pele, grelhado` → `Peito de frango grelhado`). A lista fica num arquivo do repositório e o SQL de carga é gerado a partir dele por um script (não se edita o SQL à mão).
- A carga é uma migração (`0005`) com `insert ... on conflict (taco_id) do nothing`, para poder rodar de novo sem duplicar.

### 3.2 Tabelas (migração 0005)

```sql
foods (
  id          bigint generated always as identity primary key,
  nome        text not null check (length(trim(nome)) between 2 and 80),
  kcal_100g   numeric(6,1) not null check (kcal_100g between 0 and 900),
  origem      text not null check (origem in ('taco','custom')),
  taco_id     int unique,                       -- só origem taco
  criado_por  uuid references auth.users,       -- só origem custom
  created_at  timestamptz not null default now(),
  check ((origem = 'taco') = (taco_id is not null)),
  check ((origem = 'custom') = (criado_por is not null))
)

meal_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users,
  dia         date not null,
  refeicao    text not null check (refeicao in ('cafe','almoco','lanche','jantar')),
  food_id     bigint references foods on delete set null,
  nome        text not null,                    -- cópia
  kcal_100g   numeric(6,1) not null check (kcal_100g between 0 and 900),  -- cópia
  gramas      numeric(6,1) not null check (gramas > 0 and gramas <= 5000),
  created_at  timestamptz not null default now()
)
index meal_items (user_id, dia)
```

### 3.3 RLS

- `foods`: select para autenticados; insert só `origem = 'custom' and criado_por = auth.uid()`; update/delete só `origem = 'custom' and criado_por = auth.uid()` (update não pode mudar origem/criado_por/taco_id).
- `meal_items`: select para autenticados; insert/update/delete com `can_write_log(user_id, dia)`.
- `anon` não lê nada.

### 3.4 Tamanho

~600 alimentos ≈ 150 KB. Itens: ~15/dia × 2 pessoas ≈ 11 mil linhas/ano ≈ 2–3 MB/ano. Limite do banco no plano grátis: 500 MB.

## 4. Unidades do código

- `src/lib/calorias.ts` — `kcalItem(gramas, kcal100)`, `somaKcal(itens)`, `normalizar(texto)` (minúsculo, sem acento) e `buscarAlimentos(catalogo, termo, recentes)`:
  todas as palavras do termo precisam aparecer no nome (qualquer ordem); ordem do resultado: recentes primeiro, depois nome que começa com a 1ª palavra, depois nome mais curto; até 30 resultados.
- `src/data/repo.ts` — `getFoods()` (lista inteira, guardada em memória na sessão), `createFood`, `updateFood`, `deleteFood`, `getMealItems(from, to, userId?)`, `addMealItem`, `updateMealItemGramas`, `deleteMealItem`, `recentFoodIds(userId)` (últimos 200 itens da pessoa, sem repetir, até 8).
- `src/hooks/useAlimentos.ts` — catálogo + recentes, com atualização do cache ao criar/editar/apagar.
- `src/components/Alimentos.tsx` — lista de itens da refeição, folha de busca/adicionar, editor de gramas e formulário de cadastro.

## 5. Telas

### 5.1 Hoje

- Cada refeição mostra os itens (`nome · 120 g · 154 kcal`), o subtotal e o botão **+ Alimento**.
- **+ Alimento** abre uma folha com campo de busca. Sem texto: **Usados recentemente**. Com texto: resultados.
  Tocar num alimento → campo de gramas (teclado numérico) com "= N kcal" ao vivo → **Adicionar**.
- Tocar num item → mesmo campo de gramas com **Salvar** e **Remover**.
- Busca sem resultado (ou no fim da lista): **Cadastrar "termo"** → formulário (nome, kcal, "em quantos gramas" com 100 de padrão).
  Salva o alimento convertido para 100 g e volta direto para o campo de gramas desse alimento.
- No topo: **"N kcal hoje"** (soma das quatro refeições do dia escolhido).
- Em dia que não pode editar, os itens aparecem sem os botões.

### 5.2 Configurações → Meus alimentos

Lista dos alimentos que a pessoa cadastrou (nome, kcal/100 g) com **Editar** e **Apagar** (confirmação), e o botão **Cadastrar alimento**.

### 5.3 Histórico

No detalhe do dia, cada refeição lista os itens com kcal; cada pessoa mostra o total do dia.

## 6. Erros

- Falha ao salvar item/alimento: toast "Não foi salvo, tente de novo" e o estado volta ao anterior.
- Gramas inválidas (vazio, 0, > 5000) ou kcal fora de 0–900: botão desabilitado com a dica do limite.
- Catálogo não carregou: a folha mostra "Não foi possível carregar os alimentos" com **Tentar de novo**.

## 7. Testes

- `calorias.test.ts`: conta da kcal, soma, normalização de acento, busca por palavras em qualquer ordem, ordem com recentes.
- `rls.test.ts` (PGlite): TACO só leitura; cadastrar/editar/apagar só o próprio; item só da própria pessoa e em dia permitido; apagar alimento mantém o item com a cópia; anon não lê.
- Script de geração do seed: os leites entram, os sem kcal ficam de fora, nomes curtos aplicados, sem `taco_id` repetido.
- Telas (Testing Library): adicionar item pela busca, recentes, editar gramas, remover, cadastrar pela busca vazia, total do dia, Meus alimentos, detalhe do Histórico.

## 8. Fora de escopo

Macronutrientes, meta de calorias, medidas caseiras, código de barras, itens em atividade física.
