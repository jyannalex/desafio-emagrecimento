import { useCallback, useEffect, useState } from 'react';
import { createFood, deleteFood, getFoods, recentFoodIds, updateFood } from '../data/repo';
import { kcalPor100 } from '../lib/calorias';
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

  /** `kcal` em `gramas` (como na embalagem); grava convertido para 100 g. */
  const cadastrar = useCallback(
    async (nome: string, kcal: number, gramas: number) => {
      const novo = await createFood({ nome, kcal_100g: kcalPor100(kcal, gramas), criado_por: userId });
      setCatalogo(await getFoods());
      return novo;
    },
    [userId],
  );

  const editar = useCallback(async (id: number, nome: string, kcal: number, gramas: number) => {
    const novo = await updateFood(id, { nome, kcal_100g: kcalPor100(kcal, gramas) });
    setCatalogo(await getFoods());
    return novo;
  }, []);

  const apagar = useCallback(async (id: number) => {
    await deleteFood(id);
    setCatalogo(await getFoods());
  }, []);

  return { catalogo, recentes, erro, recarregar, cadastrar, editar, apagar };
}
