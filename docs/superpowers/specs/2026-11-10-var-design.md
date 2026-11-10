# VAR (contestar pontos) — Design

Data: 2026-11-10. Complementa `2026-11-08-desafio-emagrecimento-design.md` (que tinha "contestação de pontos" fora de escopo).

## 1. Objetivo

Um participante pode contestar um ponto do outro ("chamar o VAR"). O contestado se defende ou aceita.
**O ponto só cai se o contestado aceitar.** Enquanto o lance está aberto, o ponto continua valendo (regra da confiança), marcado "em análise".

## 2. Regras

- Pontos contestáveis: `cafe`, `almoco`, `jantar`, `atividade` (≥ 60 min), `agua` (bateu a meta) — só se a pessoa realmente fez o ponto naquele dia.
- Qualquer dia do desafio até hoje. Ninguém contesta a si mesmo.
- No máximo um lance aberto **ou aceito** por (pessoa, dia, ponto). Lance retirado libera abrir outro.
- Estados: `aberto` → `aceito` (só o contestado; ponto anulado, definitivo) ou `retirado` (só quem abriu; ponto fica).
- Os dois escrevem mensagens enquanto o lance está aberto (motivo e defesa). Lance encerrado fica só para leitura.
- Ponto anulado: some de Hoje (anel), Histórico (bolinhas), Ranking (todos os placares). O registro em si (✅, água, minutos) não muda.

## 3. Dados (migração 0009)

```sql
var_lances (
  id bigint identity pk,
  alvo uuid not null references profiles on delete cascade,   -- quem foi contestado
  autor uuid not null references profiles on delete cascade,  -- quem chamou o VAR
  dia date not null,
  ponto text not null check (ponto in ('cafe','almoco','jantar','atividade','agua')),
  motivo text not null check (length(trim(motivo)) between 3 and 300),
  status text not null default 'aberto' check (status in ('aberto','aceito','retirado')),
  created_at timestamptz default now(), encerrado_em timestamptz,
  check (alvo <> autor)
)
unique (alvo, dia, ponto) where status in ('aberto','aceito')

var_mensagens (
  id bigint identity pk,
  lance_id bigint not null references var_lances on delete cascade,
  autor uuid not null references profiles on delete cascade,
  texto text not null check (length(trim(texto)) between 1 and 300),
  created_at timestamptz default now()
)
```

Função `ponto_feito(alvo, dia, ponto)` lê `daily_logs` (cafe/almoco/jantar = true; atividade_min ≥ 60; agua_ml ≥ meta_agua_ml_do_dia).

RLS:
- `var_lances`: select autenticados; insert com `autor = auth.uid()`, `status = 'aberto'`, dia no desafio e ≤ hoje, `ponto_feito(...)`;
  update só da coluna `status` (grant por coluna), `using (status = 'aberto')`,
  `with check ((status = 'aceito' and alvo = auth.uid()) or (status = 'retirado' and autor = auth.uid()))`; trigger preenche `encerrado_em`. Sem delete.
- `var_mensagens`: select autenticados; insert com `autor = auth.uid()`, lance aberto e autor ∈ {alvo, autor do lance}. Sem update/delete.

## 4. Pontos

`dayPoints(log, anulados?)` e `scoreRange/standing(..., anulados?)` recebem os pontos anulados (lances `aceito`) e não os contam.
`anuladosPorDia(lances, userId): Map<dia, Ponto[]>`.

## 5. Telas

- **Histórico** (detalhe do dia, coluna do outro): cada ponto feito ganha **VAR** (aria "Chamar o VAR: almoço de Mari, 8 de nov.").
  Abre folha "Chamar o VAR" com campo **Motivo** e botão **Abrir VAR**. Ponto com lance aberto mostra **em análise**; aceito mostra riscado **anulado pelo VAR**. Tocar no selo abre o lance.
  Na coluna da própria pessoa os selos também aparecem (sem botão VAR).
- **Folha do lance:** título "VAR: almoço de Mari · 08/11"; motivo e mensagens em ordem; campo **Escrever** + **Enviar**;
  contestado: **Aceitar e perder o ponto** (confirmação); quem abriu: **Retirar contestação**. Encerrado: mostra o resultado, sem ações.
- **Hoje:** se há lance aberto envolvendo a pessoa, painel **📺 VAR** no topo listando cada lance ("Seu almoço de 08/11 — contestado por Mari" / "Almoço de Mari, 08/11 — aguardando"), tocando abre o lance.
  O anel do dia desconta os anulados daquele dia; a refeição anulada mostra o selo **anulado pelo VAR**.
- **Ranking:** cada pessoa mostra "N ponto(s) anulado(s) pelo VAR" quando N > 0; placares já descontados.

## 6. Erros

Falha ao abrir/enviar/decidir: toast "Não foi salvo, tente de novo". Lance que mudou de estado enquanto a folha estava aberta: recarrega ao falhar.

## 7. Testes

RLS (PGlite): abrir só ponto feito, não em si mesmo, não fora do desafio/futuro, não duplicar aberto/aceito, reabrir depois de retirado; só o alvo aceita, só o autor retira, só status muda, encerrado não muda; mensagens só dos dois e só em lance aberto; anon não lê.
Unidade: `dayPoints`/`standing` com anulados, `anuladosPorDia`.
Telas: abrir VAR no Histórico, selos, folha do lance (defesa, aceitar, retirar), painel em Hoje, anel descontado, Ranking com anulados.

## 8. Fora de escopo

Notificação push, prazo para responder, juiz externo, contestar o lanche (não vale ponto).
