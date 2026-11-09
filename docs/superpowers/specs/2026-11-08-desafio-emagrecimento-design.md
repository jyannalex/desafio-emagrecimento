# Desafio de Emagrecimento — Design

**Data:** 2026-11-08
**Status:** aguardando revisão

## 1. Objetivo

Site para um casal (2 pessoas) acompanhar um desafio de emagrecimento com prazo definido. Cada um registra no dia a dia as refeições dentro da dieta, a atividade física e a água, ganha pontos por tarefa cumprida e acompanha um ranking da "competição". O peso é registrado só para acompanhamento e não entra na pontuação.

**Sucesso:** os dois conseguem registrar o dia pelo celular em menos de 1 minuto, veem os registros um do outro e o ranking sempre reflete corretamente os pontos.

**Princípio:** simples. É confiança mútua: marcou ✅, conta. Não existe validação, contestação ou aprovação pelo outro.

## 2. Regras do desafio

### 2.1 Tarefas e pontos (máximo de 5 por dia)

| Tarefa | Ponto |
|---|---|
| Café da manhã na dieta (✅) | 1 |
| Almoço na dieta (✅) | 1 |
| Lanche (✅, só registro) | 0 |
| Jantar na dieta (✅) | 1 |
| Atividade física: `atividade_min >= 60` no dia | 1 |
| Água: `agua_ml >= meta_agua_ml_do_dia` | 1 |

- O lanche continua registrável (✅ e nota), mas **não vale ponto**. *(Alterado em 2026-11-09 a pedido do usuário; o máximo passou de 6 para 5 e vale para todos os dias, inclusive os já registrados.)*
- Cada refeição tem um campo de texto **opcional** para anotar o que foi comido. Não há foto.
- A atividade é somada por botões (−10, +10 min, +30 min, +1 h), igual à água. O ponto vem só dos minutos: **60 ou mais no dia**. A coluna `atividade` fica sincronizada (`atividade_min >= 60`) mas não é usada no cálculo. *(Alterado em 2026-11-09 a pedido do usuário; antes o ponto vinha de um ✅.)*
- Cada pessoa define a própria meta de água em ml (padrão 2000). Na primeira gravação do dia, a meta vigente é copiada para o registro do dia (`meta_agua_ml_do_dia`). Mudar a meta depois não altera os dias já registrados.

### 2.2 Período e edição

- O desafio tem `data_inicio` e `data_fim`, inclusivas, definidas uma vez em Configurações.
- É possível criar ou alterar o registro diário de **qualquer dia entre o início do desafio e hoje** (fuso `America/Sao_Paulo`); o futuro fica travado. A tela Hoje tem seletor de data (setas + calendário) limitado a esse intervalo. *(Alterado em 2026-11-09 a pedido do usuário; antes era só hoje/ontem. Migração `0002`.)*
- A atividade tem um campo de texto opcional `nota_atividade` (o que foi feito).
- O peso pode ser lançado em qualquer data, porque não vale ponto.

### 2.3 Ranking

- **Total:** soma dos pontos de `data_inicio` até hoje (ou até `data_fim`, se o desafio já terminou).
- **Semana:** soma dos pontos da semana atual, de segunda a domingo, limitada ao período do desafio.
- **Hoje:** pontos do dia.
- **Aproveitamento %:** pontos ÷ (6 × dias decorridos no período considerado). "Dias decorridos" inclui hoje.
- Dias sem registro valem 0.
- Mostra os dias restantes. Depois de `data_fim`, mostra o vencedor (maior total) ou "Empate".

## 3. Arquitetura

- **Front-end:** React + TypeScript + Vite, app de página única. É um PWA com manifest e ícone, para "Adicionar à tela inicial", sem modo offline.
- **Back-end:** Supabase, com Postgres, autenticação e RLS. Não há servidor próprio.
- **Hospedagem:** GitHub Pages, publicado pelo GitHub Actions a cada push na `main`.
- **Configuração:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` ficam como variáveis/segredos do repositório. A chave anon é pública por design, e a proteção dos dados é feita pelo RLS.
- **Roteamento:** `HashRouter`, para evitar 404 no GitHub Pages.
- **Local do projeto:** `D:\ProjetosClaude\desafio-emagrecimento`.

### 3.1 Unidades do código

| Unidade | Responsabilidade | Depende de |
|---|---|---|
| `src/lib/scoring.ts` | Funções puras: pontos do dia, totais (dia/semana/total), aproveitamento, vencedor/empate | nada (puro) |
| `src/lib/dates.ts` | "Hoje" e "ontem" em `America/Sao_Paulo`, semana seg–dom, dias decorridos | nada (puro) |
| `src/lib/supabase.ts` | Cliente Supabase | env vars |
| `src/data/*.ts` | Acesso a dados: perfis, desafio, registros diários, pesos | `supabase.ts` |
| `src/pages/*` | Telas: Login, Hoje, Ranking, Histórico, Peso, Configurações | data + lib |
| `supabase/migrations/*.sql` | Tabelas, RLS, constraints | — |

As telas não calculam pontos. Elas chamam `scoring.ts`.

## 4. Login e acesso

- Login por e-mail e senha no Supabase Auth, uma conta para cada pessoa.
- Depois que os dois se cadastrarem, os novos cadastros são **desligados** no painel do Supabase (passo manual documentado no README).
- Ao criar o usuário, um trigger cria a linha em `profiles`.
- Os dois **leem** todos os dados. Cada um só **escreve** os próprios.

## 5. Modelo de dados

```sql
profiles (
  id            uuid primary key references auth.users,
  nome          text not null,
  meta_agua_ml  int  not null default 2000 check (meta_agua_ml > 0)
)

challenge (
  id           int primary key default 1 check (id = 1),  -- linha única
  nome         text not null,
  data_inicio  date not null,
  data_fim     date not null check (data_fim >= data_inicio)
)

daily_logs (
  user_id              uuid references profiles(id),
  dia                  date not null,
  cafe                 bool not null default false,
  almoco               bool not null default false,
  lanche               bool not null default false,
  jantar               bool not null default false,
  nota_cafe            text,
  nota_almoco          text,
  nota_lanche          text,
  nota_jantar          text,
  atividade            bool not null default false,
  atividade_min        int  not null default 0 check (atividade_min >= 0),
  agua_ml              int  not null default 0 check (agua_ml >= 0),
  meta_agua_ml_do_dia  int  not null check (meta_agua_ml_do_dia > 0),
  updated_at           timestamptz not null default now(),
  primary key (user_id, dia)
)

weights (
  id       bigint generated always as identity primary key,
  user_id  uuid references profiles(id),
  dia      date not null,
  kg       numeric(5,2) not null check (kg > 0 and kg < 400),
  unique (user_id, dia)
)
```

### 5.1 RLS

- `SELECT` em todas as tabelas: qualquer usuário autenticado.
- `profiles`: `UPDATE` só onde `id = auth.uid()`.
- `challenge`: `INSERT`/`UPDATE` por qualquer usuário autenticado. Só existem os dois.
- `daily_logs`: `INSERT`/`UPDATE` só onde `user_id = auth.uid()` **e** `dia` está entre `(now() at time zone 'America/Sao_Paulo')::date - 1` e esse mesmo "hoje" **e** `dia` está dentro de `challenge.data_inicio..data_fim`. Não há `DELETE`.
- `weights`: `INSERT`/`UPDATE`/`DELETE` só onde `user_id = auth.uid()`.

## 6. Telas

1. **Login:** e-mail e senha.
2. **Hoje** (tela inicial): seletor Hoje/Ontem; quatro cartões de refeição com ✅ e nota opcional; atividade com ✅ e minutos; água com barra de progresso até a meta e botões **+250**, **+500** e **−250** (sem passar de 0); pontos do dia "x/6".
3. **Ranking:** os dois lado a lado com total, semana, hoje e aproveitamento %; dias restantes; vencedor ou empate quando o desafio termina.
4. **Histórico:** lista por dia (do mais recente ao mais antigo) com os pontos de cada um. Ao tocar num dia, aparecem os detalhes, incluindo as notas das refeições. Só leitura para dias travados.
5. **Peso:** lançar uma pesagem (data + kg) e ver o gráfico de linha com os dois, mais a variação desde a primeira pesagem.
6. **Configurações:** nome, meta de água, nome/datas do desafio e sair.

Se o desafio ainda não foi configurado, o app leva para Configurações.

## 7. Tratamento de erros

- Cada alteração salva na hora com atualização otimista. Se der erro, o estado volta ao anterior e aparece um aviso "Não salvou, tente de novo".
- Sessão expirada leva de volta à tela de Login.
- Em dia travado, os controles ficam desabilitados com a mensagem "Esse dia já fechou". O banco também recusa via RLS.
- Variáveis de ambiente ausentes mostram uma tela de erro clara em vez de uma página em branco.

## 8. Testes

- **Vitest (TDD):** `scoring.ts` e `dates.ts`. Pontos 0–6, água exatamente na meta, meta alterada entre dias, totais por semana que atravessam o início ou o fim do desafio, aproveitamento, empate, virada de dia no fuso de São Paulo.
- **SQL de RLS:** um script que, como usuário A, confirma que não consegue gravar o registro de B nem um dia de anteontem, e que consegue gravar hoje e ontem.
- **Manual:** roteiro curto no celular (login, marcar tarefas, água, peso, ranking, instalar na tela inicial).

## 9. Fora de escopo

Modo offline/sincronização, fotos, notificações, contestação de pontos, mais de 2 participantes, calorias e cardápios, pontuação por peso.
