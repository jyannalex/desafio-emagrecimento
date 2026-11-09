import { deletePhoto, deletePhotosUntil, myPhotoStats, photoUrls, uploadPhoto } from './repo';

// Supabase falso: cada consulta encadeada registra as chamadas e devolve a próxima resposta da fila da tabela.
const log: string[] = [];
const filas: Record<string, { data: unknown; error: null | { message: string } }[]> = {};
const storage = {
  upload: vi.fn(async (path: string, _b?: Blob, _o?: object) => (log.push(`upload ${path}`), { data: { path }, error: null })),
  remove: vi.fn(async (paths: string[]) => (log.push(`remove ${paths.join(',')}`), { data: [], error: null })),
  createSignedUrls: vi.fn(async (paths: string[]) => ({
    data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}?t=1`, error: null })),
    error: null,
  })),
};

function consulta(tabela: string) {
  const passos: string[] = [];
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lte', 'gte', 'in', 'upsert', 'delete', 'single', 'maybeSingle', 'order']) {
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

vi.mock('../lib/supabase', () => ({
  db: () => ({ from: (t: string) => consulta(t), storage: { from: () => storage } }),
}));

beforeEach(() => {
  log.length = 0;
  for (const k of Object.keys(filas)) delete filas[k];
  vi.clearAllMocks();
});

test('enviar foto nova: sobe o arquivo na pasta da pessoa e grava a linha', async () => {
  filas.photos = [
    { data: null, error: null }, // não havia foto
    { data: { id: 7, user_id: 'u1', dia: '2026-11-09', tarefa: 'almoco', path: 'p', bytes: 3 }, error: null },
  ];
  const foto = await uploadPhoto('u1', '2026-11-09', 'almoco', new Blob(['abc'], { type: 'image/jpeg' }));
  expect(foto.id).toBe(7);
  expect(storage.upload.mock.calls[0][0]).toMatch(/^u1\/2026-11-09\/almoco-\d+\.jpg$/);
  expect(storage.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/jpeg', upsert: false });
  expect(log[2]).toMatch(/^photos\.upsert\(.*"bytes":3.*\)/);
  expect(storage.remove).not.toHaveBeenCalled();
});

test('trocar foto: depois de gravar a nova, apaga o arquivo antigo', async () => {
  filas.photos = [
    { data: { path: 'u1/2026-11-09/almoco-1.jpg' }, error: null },
    { data: { id: 7, user_id: 'u1', dia: '2026-11-09', tarefa: 'almoco', path: 'novo', bytes: 3 }, error: null },
  ];
  await uploadPhoto('u1', '2026-11-09', 'almoco', new Blob(['abc']));
  expect(log.at(-1)).toBe('remove u1/2026-11-09/almoco-1.jpg');
});

test('se gravar a linha falhar, o arquivo recém-enviado é apagado', async () => {
  filas.photos = [{ data: null, error: null }, { data: null, error: { message: 'rls' } }];
  await expect(uploadPhoto('u1', '2026-11-09', 'cafe', new Blob(['a']))).rejects.toThrow('rls');
  expect(storage.remove.mock.calls[0][0][0]).toMatch(/^u1\/2026-11-09\/cafe-/);
});

test('remover foto: apaga o arquivo e depois a linha', async () => {
  await deletePhoto({ id: 7, path: 'u1/a.jpg' });
  expect(log).toEqual(['remove u1/a.jpg', 'photos.delete().eq("id",7)']);
});

test('estatística soma o tamanho das minhas fotos', async () => {
  filas.photos = [{ data: [{ bytes: 200 }, { bytes: 300 }], error: null }];
  expect(await myPhotoStats('u1')).toEqual({ count: 2, bytes: 500 });
  expect(log[0]).toBe('photos.select("bytes").eq("user_id","u1")');
});

test('limpar até a data: só as minhas, até o dia, em lotes de 100', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ id: i, path: `u1/${i}.jpg` }));
  filas.photos = [{ data: rows, error: null }];
  expect(await deletePhotosUntil('u1', '2026-11-30')).toBe(150);
  expect(log[0]).toBe('photos.select("id, path").eq("user_id","u1").lte("dia","2026-11-30")');
  expect(storage.remove).toHaveBeenCalledTimes(2);
  expect(storage.remove.mock.calls[0][0]).toHaveLength(100);
  expect(storage.remove.mock.calls[1][0]).toHaveLength(50);
  // arquivo antes da linha em cada lote
  expect(log[1]).toMatch(/^remove /);
  expect(log[2]).toMatch(/^photos\.delete\(\)\.in\("id",/);
});

test('links das fotos ficam em cache', async () => {
  const a = await photoUrls(['u1/x.jpg']);
  const b = await photoUrls(['u1/x.jpg']);
  expect(a['u1/x.jpg']).toBe('https://x/u1/x.jpg?t=1');
  expect(b).toEqual(a);
  expect(storage.createSignedUrls).toHaveBeenCalledTimes(1);
});
