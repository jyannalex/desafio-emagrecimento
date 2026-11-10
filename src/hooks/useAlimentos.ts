import { useCallback, useEffect, useState } from 'react';
import { createFood, deleteFood, getFoods, recentFoodIds, updateFood, type MedidaFood } from '../data/repo';
import type { Food } from '../types';

/** Catálogo de alimentos (baixado uma vez por sessão) e os usados por último pela pessoa. */
export function useAlimentos(userId: string) {
  const [catalogo, setCatalogo] = useState<Food[] | null>(null);
  const [recentes, setRecentes] = useState<number[]>([]);
  const [erro, setErro] = useState(false);

  const recarregar = useCallback(async () => {
    setErro(false);
    try {
      setCatalogo(await getFoods());
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    recarregar();
    recentFoodIds(userId)
      .then(setRecentes)
      .catch(() => {
        /* sem recentes: a busca continua funcionando */
      });
  }, [userId, recarregar]);

  /** medida: por grama (kcal_100g) ou por unidade (kcal_unidade). */
  const cadastrar = useCallback(
    async (nome: string, medida: MedidaFood) => {
      const novo = await createFood({ nome, ...medida, criado_por: userId });
      setCatalogo(await getFoods());
      return novo;
    },
    [userId],
  );

  const editar = useCallback(async (id: number, nome: string, medida: MedidaFood) => {
    const novo = await updateFood(id, { nome, ...medida });
    setCatalogo(await getFoods());
    return novo;
  }, []);

  const apagar = useCallback(async (id: number) => {
    await deleteFood(id);
    setCatalogo(await getFoods());
  }, []);

  return { catalogo, recentes, erro, recarregar, cadastrar, editar, apagar };
}
