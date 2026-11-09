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
  await db.exec(read('../migrations/0001_init.sql'));
  await db.exec(read('../migrations/0002_qualquer_dia_e_nota_atividade.sql'));
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
