// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const read = (p: string) => readFileSync(resolve(__dirname, p), 'utf8');

let db: PGlite;

async function as(uid: string, sql: string) {
  await db.exec(`set role authenticated; set request.jwt.claims = '{"sub":"${uid}"}';`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role; reset request.jwt.claims;');
  }
}

const insLog = (uid: string, dia: string) =>
  `insert into daily_logs (user_id, dia, cafe, meta_agua_ml_do_dia) values ('${uid}', ${dia}, true, 2000)`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(read('auth_stub.sql'));
  await db.exec(read('storage_stub.sql'));
  await db.exec(read('../migrations/0001_init.sql'));
  await db.exec(read('../migrations/0002_qualquer_dia_e_nota_atividade.sql'));
  await db.exec(read('../migrations/0003_fotos_e_cores.sql'));
  await db.exec(read('../migrations/0004_cor_livre.sql'));
  await db.exec(read('../migrations/0005_alimentos.sql'));
  await db.exec(read('../migrations/0006_taco.sql'));
  await db.exec(read('../migrations/0007_premio.sql'));
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${A}', 'ana@x.com', '{"nome":"Ana"}'), ('${B}', 'beto@x.com', '{}');
    insert into challenge (nome, data_inicio, data_fim) values ('Teste', public.today_br() - 10, public.today_br() + 10);
    insert into daily_logs (user_id, dia, meta_agua_ml_do_dia) values ('${B}', public.today_br(), 2000);
  `);
}, 60_000);

test('trigger cria profiles com nome do metadata ou do e-mail', async () => {
  const r = await db.query<{ id: string; nome: string; meta_agua_ml: number }>('select id, nome, meta_agua_ml from profiles order by nome');
  expect(r.rows).toEqual([
    { id: A, nome: 'Ana', meta_agua_ml: 2000 },
    { id: B, nome: 'beto', meta_agua_ml: 2000 },
  ]);
});

test('A grava hoje e ontem', async () => {
  await as(A, insLog(A, 'public.today_br()'));
  await as(A, insLog(A, 'public.today_br() - 1'));
  const r = await as(A, `select count(*)::int as n from daily_logs where user_id = '${A}'`);
  expect(r.rows[0]).toEqual({ n: 2 });
});

test('A grava um dia antigo dentro do desafio', async () => {
  await as(A, insLog(A, 'public.today_br() - 7'));
});

test('A não grava amanhã', async () => {
  await expect(as(A, insLog(A, 'public.today_br() + 1'))).rejects.toThrow(/row-level security/);
});

test('A não grava antes do início do desafio', async () => {
  await expect(as(A, insLog(A, 'public.today_br() - 11'))).rejects.toThrow(/row-level security/);
});

test('A grava a nota da atividade', async () => {
  await as(A, `update daily_logs set nota_atividade = 'caminhada' where user_id = '${A}' and dia = public.today_br() - 7`);
  const r = await db.query<{ nota_atividade: string }>(`select nota_atividade from daily_logs where user_id = '${A}' and dia = public.today_br() - 7`);
  expect(r.rows[0].nota_atividade).toBe('caminhada');
});

test('A não grava no nome de B', async () => {
  await expect(as(A, `insert into daily_logs (user_id, dia, meta_agua_ml_do_dia) values ('${B}', public.today_br() - 1, 2000)`)).rejects.toThrow(/row-level security/);
});

test('A não grava fora do período do desafio', async () => {
  await db.exec(`update challenge set data_fim = public.today_br() - 2`);
  try {
    const upd = await as(A, `update daily_logs set lanche = true where user_id = '${A}' and dia = public.today_br()`);
    expect(upd.affectedRows).toBe(0);
    await expect(as(B, insLog(B, 'public.today_br() - 1'))).rejects.toThrow(/row-level security/);
  } finally {
    await db.exec(`update challenge set data_fim = public.today_br() + 10`);
  }
});

test('A não altera o registro de B', async () => {
  const r = await as(A, `update daily_logs set cafe = true where user_id = '${B}'`);
  expect(r.affectedRows).toBe(0);
});

test('A não altera dia fora do desafio já existente', async () => {
  await db.exec(`insert into daily_logs (user_id, dia, meta_agua_ml_do_dia) values ('${A}', public.today_br() - 15, 2000)`);
  const r = await as(A, `update daily_logs set cafe = true where user_id = '${A}' and dia = public.today_br() - 15`);
  expect(r.affectedRows).toBe(0);
});

test('A não apaga registros diários', async () => {
  const r = await as(A, `delete from daily_logs where user_id = '${A}'`);
  expect(r.affectedRows).toBe(0);
});

test('A lê os registros de B', async () => {
  const r = await as(A, `select count(*)::int as n from daily_logs where user_id = '${B}'`);
  expect(r.rows[0]).toEqual({ n: 1 });
});

test('A lança peso de 30 dias atrás, mas não no nome de B', async () => {
  await as(A, `insert into weights (user_id, dia, kg) values ('${A}', public.today_br() - 30, 80.5)`);
  await expect(as(A, `insert into weights (user_id, dia, kg) values ('${B}', public.today_br(), 70)`)).rejects.toThrow(/row-level security/);
});

test('A altera só o próprio perfil', async () => {
  const own = await as(A, `update profiles set meta_agua_ml = 2500 where id = '${A}'`);
  const other = await as(A, `update profiles set meta_agua_ml = 9999 where id = '${B}'`);
  expect(own.affectedRows).toBe(1);
  expect(other.affectedRows).toBe(0);
});

test('A configura o desafio', async () => {
  const r = await as(A, `update challenge set nome = 'Nosso desafio' where id = 1`);
  expect(r.affectedRows).toBe(1);
});

test('anônimo não lê nada', async () => {
  await db.exec(`set role anon;`);
  try {
    const r = await db.query('select count(*)::int as n from daily_logs');
    expect(r.rows[0]).toEqual({ n: 0 });
  } finally {
    await db.exec('reset role;');
  }
});

// O app grava via upsert (insert ... on conflict do update), como o PostgREST faz.
const upsert = (uid: string, dia: string) =>
  `insert into daily_logs (user_id, dia, agua_ml, meta_agua_ml_do_dia) values ('${uid}', ${dia}, 750, 2000)
   on conflict (user_id, dia) do update set agua_ml = excluded.agua_ml`;

test('upsert do app atualiza registro existente de hoje', async () => {
  await as(A, upsert(A, 'public.today_br()'));
  const r = await db.query<{ agua_ml: number }>(`select agua_ml from daily_logs where user_id = '${A}' and dia = public.today_br()`);
  expect(r.rows[0].agua_ml).toBe(750);
});

test('upsert do app em dia fora do desafio é recusado', async () => {
  await expect(as(A, upsert(A, 'public.today_br() - 15'))).rejects.toThrow(/row-level security/);
});

// ── 0003: cores e fotos ──

test('cada um escolhe a própria cor, só entre as da paleta', async () => {
  const own = await as(A, `update profiles set cor = 'menta' where id = '${A}'`);
  expect(own.affectedRows).toBe(1);
  await expect(as(A, `update profiles set cor = 'roxo-neon' where id = '${A}'`)).rejects.toThrow(/check/);
  const other = await as(A, `update profiles set cor = 'uva' where id = '${B}'`);
  expect(other.affectedRows).toBe(0);
});

const insFoto = (uid: string, dia: string, tarefa: string, path: string) =>
  `insert into photos (user_id, dia, tarefa, path, bytes) values ('${uid}', ${dia}, '${tarefa}', '${path}', 180000)`;

test('A registra foto de um dia do desafio na própria pasta', async () => {
  await as(A, insFoto(A, 'public.today_br()', 'almoco', `${A}/hoje-almoco.jpg`));
  await as(A, insFoto(A, 'public.today_br() - 3', 'atividade', `${A}/antes-atividade.jpg`));
  const r = await as(B, `select count(*)::int as n from photos where user_id = '${A}'`);
  expect(r.rows[0]).toEqual({ n: 2 });
});

test('foto: não no nome de B, não na pasta de B, não no futuro, tarefa válida', async () => {
  await expect(as(A, insFoto(B, 'public.today_br()', 'cafe', `${B}/x.jpg`))).rejects.toThrow(/row-level security/);
  await expect(as(A, insFoto(A, 'public.today_br()', 'cafe', `${B}/x.jpg`))).rejects.toThrow(/row-level security/);
  await expect(as(A, insFoto(A, 'public.today_br() + 1', 'cafe', `${A}/y.jpg`))).rejects.toThrow(/row-level security/);
  await expect(as(A, insFoto(A, 'public.today_br()', 'agua', `${A}/z.jpg`))).rejects.toThrow(/check/);
});

test('trocar a foto da mesma tarefa é upsert', async () => {
  await as(
    A,
    `${insFoto(A, 'public.today_br()', 'almoco', `${A}/hoje-almoco-2.jpg`)}
     on conflict (user_id, dia, tarefa) do update set path = excluded.path, bytes = excluded.bytes`,
  );
  const r = await db.query<{ path: string }>(`select path from photos where user_id = '${A}' and tarefa = 'almoco'`);
  expect(r.rows).toEqual([{ path: `${A}/hoje-almoco-2.jpg` }]);
});

test('A apaga as próprias fotos (até de dia travado), não as de B', async () => {
  await db.exec(`insert into photos (user_id, dia, tarefa, path, bytes) values ('${B}', public.today_br(), 'cafe', '${B}/b.jpg', 1000)`);
  const other = await as(A, `delete from photos where user_id = '${B}'`);
  expect(other.affectedRows).toBe(0);
  await db.exec(`update challenge set data_fim = public.today_br() - 5`);
  try {
    const own = await as(A, `delete from photos where user_id = '${A}' and tarefa = 'atividade'`);
    expect(own.affectedRows).toBe(1);
  } finally {
    await db.exec(`update challenge set data_fim = public.today_br() + 10`);
  }
});

test('bucket fotos é privado e limita tamanho e tipo', async () => {
  const r = await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>(
    `select public, file_size_limit::int as file_size_limit, allowed_mime_types from storage.buckets where id = 'fotos'`,
  );
  expect(r.rows[0]).toEqual({ public: false, file_size_limit: 2097152, allowed_mime_types: ['image/jpeg'] });
});

const insObj = (path: string) => `insert into storage.objects (bucket_id, name) values ('fotos', '${path}')`;

test('arquivo: A envia na própria pasta, não na de B nem em outro bucket', async () => {
  await as(A, insObj(`${A}/2026-11-09/almoco-1.jpg`));
  await expect(as(A, insObj(`${B}/2026-11-09/almoco-1.jpg`))).rejects.toThrow(/row-level security/);
  await expect(as(A, `insert into storage.objects (bucket_id, name) values ('outro', '${A}/x.jpg')`)).rejects.toThrow();
});

test('arquivo: os dois veem, cada um só apaga o seu', async () => {
  await db.exec(insObj(`${B}/2026-11-09/cafe-1.jpg`));
  const ver = await as(A, `select count(*)::int as n from storage.objects where bucket_id = 'fotos'`);
  expect(ver.rows[0]).toEqual({ n: 2 });
  const delB = await as(A, `delete from storage.objects where name like '${B}/%'`);
  expect(delB.affectedRows).toBe(0);
  const delA = await as(A, `delete from storage.objects where name like '${A}/%'`);
  expect(delA.affectedRows).toBe(1);
});

test('anônimo não vê fotos', async () => {
  await db.exec(`set role anon;`);
  try {
    const r = await db.query(`select (select count(*) from photos)::int as f, (select count(*) from storage.objects)::int as o`);
    expect(r.rows[0]).toEqual({ f: 0, o: 0 });
  } finally {
    await db.exec('reset role;');
  }
});

test('cor livre: aceita #rrggbb minúsculo, recusa formato errado', async () => {
  const ok = await as(A, `update profiles set cor = '#3a7bd5' where id = '${A}'`);
  expect(ok.affectedRows).toBe(1);
  await expect(as(A, `update profiles set cor = '#3A7BD5' where id = '${A}'`)).rejects.toThrow(/check/);
  await expect(as(A, `update profiles set cor = '#12345' where id = '${A}'`)).rejects.toThrow(/check/);
  await expect(as(A, `update profiles set cor = 'red' where id = '${A}'`)).rejects.toThrow(/check/);
});

// ---------- alimentos e itens das refeições ----------

const insFood = (uid: string, nome: string, kcal = 100, origem = 'custom') =>
  `insert into foods (nome, kcal_100g, origem, criado_por) values ('${nome}', ${kcal}, '${origem}', '${uid}') returning id`;
const insItem = (uid: string, dia: string, refeicao = 'almoco', gramas = 120, foodId: string | number = 'null') =>
  `insert into meal_items (user_id, dia, refeicao, food_id, nome, kcal_100g, gramas)
   values ('${uid}', ${dia}, '${refeicao}', ${foodId}, 'Arroz branco cozido', 128, ${gramas}) returning id`;

test('TACO carregada: 593 alimentos, arroz branco com 128 kcal', async () => {
  const r = await as(A, `select count(*)::int as n from foods where origem = 'taco'`);
  expect(r.rows[0]).toEqual({ n: 593 });
  const arroz = await as(A, `select kcal_100g::float as k from foods where taco_id = 3`);
  expect(arroz.rows[0]).toEqual({ k: 128 });
});

test('ninguém edita nem apaga alimento da TACO', async () => {
  const up = await as(A, `update foods set kcal_100g = 1 where taco_id = 3`);
  expect(up.affectedRows).toBe(0);
  const del = await as(A, `delete from foods where taco_id = 3`);
  expect(del.affectedRows).toBe(0);
});

test('alimento cadastrado: os dois veem, só o dono edita e apaga', async () => {
  const id = (await as(A, insFood(A, 'Marmita da tia', 150))).rows[0] as { id: number };
  const ver = await as(B, `select nome from foods where id = ${id.id}`);
  expect(ver.rows).toEqual([{ nome: 'Marmita da tia' }]);
  expect((await as(B, `update foods set kcal_100g = 1 where id = ${id.id}`)).affectedRows).toBe(0);
  expect((await as(B, `delete from foods where id = ${id.id}`)).affectedRows).toBe(0);
  expect((await as(A, `update foods set kcal_100g = 160 where id = ${id.id}`)).affectedRows).toBe(1);
  await expect(as(A, `update foods set criado_por = '${B}' where id = ${id.id}`)).rejects.toThrow(/row-level security/);
  expect((await as(A, `delete from foods where id = ${id.id}`)).affectedRows).toBe(1);
});

test('não cadastra em nome do outro nem como TACO', async () => {
  await expect(as(A, insFood(B, 'Falso'))).rejects.toThrow(/row-level security/);
  await expect(
    as(A, `insert into foods (nome, kcal_100g, origem, taco_id) values ('Falso', 10, 'taco', 8000)`),
  ).rejects.toThrow(/row-level security/);
});

test('limites do alimento: kcal até 900, nome com 2 a 80 letras', async () => {
  await expect(as(A, insFood(A, 'Gordura', 901))).rejects.toThrow(/check/);
  await expect(as(A, insFood(A, ' a '))).rejects.toThrow(/check/);
  await expect(as(A, insFood(A, 'x'.repeat(81)))).rejects.toThrow(/check/);
});

test('item: A registra o seu hoje, não o de B nem amanhã; B vê o de A', async () => {
  await as(A, insItem(A, 'public.today_br()'));
  await expect(as(A, insItem(B, 'public.today_br()'))).rejects.toThrow(/row-level security/);
  await expect(as(A, insItem(A, 'public.today_br() + 1'))).rejects.toThrow(/row-level security/);
  const r = await as(B, `select count(*)::int as n from meal_items where user_id = '${A}'`);
  expect(r.rows[0]).toEqual({ n: 1 });
});

test('item: A muda gramas e apaga o seu; B não apaga o de A', async () => {
  const { id } = (await as(A, insItem(A, 'public.today_br()', 'jantar'))).rows[0] as { id: number };
  expect((await as(B, `delete from meal_items where id = ${id}`)).affectedRows).toBe(0);
  expect((await as(A, `update meal_items set gramas = 200 where id = ${id}`)).affectedRows).toBe(1);
  expect((await as(A, `delete from meal_items where id = ${id}`)).affectedRows).toBe(1);
});

test('apagar o alimento mantém o item com a cópia de nome e kcal', async () => {
  const { id: foodId } = (await as(A, insFood(A, 'Bolo da vó', 380))).rows[0] as { id: number };
  const { id } = (
    await as(
      A,
      `insert into meal_items (user_id, dia, refeicao, food_id, nome, kcal_100g, gramas)
       values ('${A}', public.today_br(), 'lanche', ${foodId}, 'Bolo da vó', 380, 80) returning id`,
    )
  ).rows[0] as { id: number };
  await as(A, `delete from foods where id = ${foodId}`);
  const r = await as(A, `select food_id, nome, kcal_100g::float as k, gramas::float as g from meal_items where id = ${id}`);
  expect(r.rows[0]).toEqual({ food_id: null, nome: 'Bolo da vó', k: 380, g: 80 });
});

test('limites do item: gramas entre 0 e 5000, refeição válida', async () => {
  await expect(as(A, insItem(A, 'public.today_br()', 'almoco', 0))).rejects.toThrow(/check/);
  await expect(as(A, insItem(A, 'public.today_br()', 'almoco', 5001))).rejects.toThrow(/check/);
  await expect(as(A, insItem(A, 'public.today_br()', 'ceia'))).rejects.toThrow(/check/);
});

test('anônimo não vê alimentos nem itens', async () => {
  await db.exec(`set role anon;`);
  try {
    const r = await db.query(`select (select count(*) from foods)::int as f, (select count(*) from meal_items)::int as i`);
    expect(r.rows[0]).toEqual({ f: 0, i: 0 });
  } finally {
    await db.exec('reset role;');
  }
});

test('prêmio do desafio: grava texto de até 120 letras', async () => {
  const ok = await as(A, `update challenge set premio = 'Jantar no japonês' where id = 1`);
  expect(ok.affectedRows).toBe(1);
  await expect(as(A, `update challenge set premio = '${'x'.repeat(121)}' where id = 1`)).rejects.toThrow(/check/);
  await as(A, `update challenge set premio = null where id = 1`);
});
