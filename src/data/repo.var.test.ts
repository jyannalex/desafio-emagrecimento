import { abrirLance, decidirLance, enviarMensagem, getLances, getMensagens } from './repo';

// Supabase falso: cada consulta encadeada registra as chamadas e devolve a próxima resposta da fila da tabela.
const log: string[] = [];
const filas: Record<string, { data: unknown; error: null | { message: string } }[]> = {};

function consulta(tabela: string) {
  const passos: string[] = [];
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'insert', 'update', 'single', 'order']) {
    q[m] = (...args: unknown[]) => {
      passos.push(`${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
      return q;
    };
  }
  q.then = (ok: (v: unknown) => void) => {
    log.push(`${tabela}.${passos.join('.')}`);
    ok(filas[tabela]?.shift() ?? { data: null, error: null });
  };
  return q;
}

vi.mock('../lib/supabase', () => ({ db: () => ({ from: (t: string) => consulta(t) }) }));

const COLS = 'id, alvo, autor, dia, ponto, motivo, status, created_at';
const lance = { id: 1, alvo: 'b', autor: 'a', dia: '2026-11-08', ponto: 'almoco', motivo: 'coxinha', status: 'aberto', created_at: 't' };

beforeEach(() => {
  log.length = 0;
  for (const k of Object.keys(filas)) delete filas[k];
});

test('lê todos os lances em ordem', async () => {
  filas.var_lances = [{ data: [lance], error: null }];
  expect(await getLances()).toEqual([lance]);
  expect(log[0]).toBe(`var_lances.select("${COLS}").order("created_at")`);
});

test('abre lance', async () => {
  filas.var_lances = [{ data: lance, error: null }];
  await abrirLance({ alvo: 'b', autor: 'a', dia: '2026-11-08', ponto: 'almoco', motivo: 'coxinha' });
  expect(log[0]).toBe(
    `var_lances.insert({"alvo":"b","autor":"a","dia":"2026-11-08","ponto":"almoco","motivo":"coxinha"}).select("${COLS}").single()`,
  );
});

test('mensagens do lance e enviar', async () => {
  filas.var_mensagens = [{ data: [], error: null }, { data: { id: 3 }, error: null }];
  await getMensagens(1);
  expect(log[0]).toBe('var_mensagens.select("id, lance_id, autor, texto, created_at").eq("lance_id",1).order("created_at").order("id")');
  await enviarMensagem({ lance_id: 1, autor: 'b', texto: 'era integral' });
  expect(log[1]).toBe('var_mensagens.insert({"lance_id":1,"autor":"b","texto":"era integral"}).select("id, lance_id, autor, texto, created_at").single()');
});

test('decidir muda só o status de lance aberto', async () => {
  filas.var_lances = [{ data: [{ ...lance, status: 'aceito' }], error: null }];
  expect((await decidirLance(1, 'aceito')).status).toBe('aceito');
  expect(log[0]).toBe(`var_lances.update({"status":"aceito"}).eq("id",1).eq("status","aberto").select("${COLS}")`);
});

test('decidir lance que já foi decidido dá erro', async () => {
  filas.var_lances = [{ data: [], error: null }];
  await expect(decidirLance(1, 'retirado')).rejects.toThrow('Esse lance já foi decidido');
});

test('erro do banco vira exceção', async () => {
  filas.var_lances = [{ data: null, error: { message: 'rls' } }];
  await expect(abrirLance({ alvo: 'b', autor: 'a', dia: 'd', ponto: 'cafe', motivo: 'xxx' })).rejects.toThrow('rls');
});
