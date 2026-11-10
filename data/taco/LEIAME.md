# Dados da TACO

`food.csv` e `nutrients.csv` vêm de [raulfdm/taco-api](https://github.com/raulfdm/taco-api) (`references/csv`, licença MIT),
que transcreve a Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição, NEPA/UNICAMP.

`nomes-curtos.json` troca o nome dos alimentos mais comuns por um nome do dia a dia (chave = id da TACO).

Para atualizar a carga no banco: `node scripts/taco-seed.mjs` (gera `supabase/migrations/0006_taco.sql`).
