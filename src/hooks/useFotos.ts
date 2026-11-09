import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import { deletePhoto, getPhotos, photoUrls, uploadPhoto } from '../data/repo';
import { compressImage } from '../lib/imagem';
import type { Photo, Tarefa } from '../types';

type Estado = { fotos: Partial<Record<Tarefa, Photo>>; urls: Record<string, string> };

/** Fotos da pessoa num dia: carrega, envia (já reduzida) e remove. */
export function useFotos(userId: string, dia: string) {
  const toast = useToast();
  const [st, setSt] = useState<Estado>({ fotos: {}, urls: {} });
  const [ocupado, setOcupado] = useState<Partial<Record<Tarefa, boolean>>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCarregado(false);
    (async () => {
      try {
        const lista = await getPhotos(dia, dia, userId);
        const urls = lista.length ? await photoUrls(lista.map((f) => f.path)) : {};
        if (!vivo) return;
        const fotos: Estado['fotos'] = {};
        for (const f of lista) fotos[f.tarefa] = f;
        setSt({ fotos, urls });
      } catch {
        /* sem fotos visíveis; o resto do dia continua funcionando */
      } finally {
        if (vivo) setCarregado(true);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [userId, dia]);

  const marcar = (t: Tarefa, v: boolean) => setOcupado((o) => ({ ...o, [t]: v }));

  const enviar = useCallback(
    async (tarefa: Tarefa, arquivo: File) => {
      marcar(tarefa, true);
      try {
        const reduzida = await compressImage(arquivo);
        const foto = await uploadPhoto(userId, dia, tarefa, reduzida);
        // mostra a versão local: não precisa baixar de novo o que acabou de subir
        const previa = URL.createObjectURL(reduzida);
        setSt((s) => ({ fotos: { ...s.fotos, [tarefa]: foto }, urls: { ...s.urls, [foto.path]: previa } }));
      } catch {
        toast('A foto não foi enviada, tente de novo');
      } finally {
        marcar(tarefa, false);
      }
    },
    [userId, dia, toast],
  );

  const remover = useCallback(
    async (tarefa: Tarefa) => {
      const foto = st.fotos[tarefa];
      if (!foto) return;
      marcar(tarefa, true);
      try {
        await deletePhoto(foto);
        setSt((s) => {
          const fotos = { ...s.fotos };
          delete fotos[tarefa];
          return { ...s, fotos };
        });
      } catch {
        toast('A foto não foi removida, tente de novo');
      } finally {
        marcar(tarefa, false);
      }
    },
    [st.fotos, toast],
  );

  const urlDe = (t: Tarefa) => {
    const f = st.fotos[t];
    return f ? st.urls[f.path] : undefined;
  };

  return { fotos: st.fotos, urlDe, ocupado, carregado, enviar, remover };
}
