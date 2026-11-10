import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../components/Toast';
import { addMealItem, deleteMealItem, getMealItems, updateMealItemQuantidade } from '../data/repo';
import type { Food, MealItem, Refeicao } from '../types';

const ERRO = 'Não foi salvo, tente de novo';

/** Itens comidos pela pessoa num dia. Mudanças aparecem na hora e voltam atrás se o banco recusar. */
export function useItensDia(userId: string, dia: string) {
  const toast = useToast();
  const [itens, setItens] = useState<MealItem[]>([]);
  // carregado só fica true depois de ler do banco; com erro, nada de lançar (evita duplicar o que não apareceu)
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const temp = useRef(0);

  useEffect(() => {
    let vivo = true;
    setCarregado(false);
    setErro(false);
    setItens([]);
    getMealItems(dia, dia, userId)
      .then((l) => {
        if (!vivo) return;
        setItens(l);
        setCarregado(true);
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [userId, dia, tentativa]);

  const recarregar = useCallback(() => setTentativa((t) => t + 1), []);

  const adicionar = useCallback(
    /** true se o banco gravou. */
    async (refeicao: Refeicao, food: Food, qtd: number): Promise<boolean> => {
      const porUnidade = food.kcal_unidade != null;
      const novo: Omit<MealItem, 'id'> = {
        user_id: userId,
        dia,
        refeicao,
        food_id: food.id,
        nome: food.nome,
        kcal_100g: porUnidade ? null : food.kcal_100g,
        gramas: porUnidade ? null : qtd,
        unidades: porUnidade ? qtd : null,
        kcal_unidade: porUnidade ? food.kcal_unidade : null,
      };
      const idTemp = --temp.current;
      setItens((l) => [...l, { ...novo, id: idTemp }]);
      try {
        const salvo = await addMealItem(novo);
        setItens((l) => l.map((i) => (i.id === idTemp ? salvo : i)));
        return true;
      } catch {
        setItens((l) => l.filter((i) => i.id !== idTemp));
        toast(ERRO);
        return false;
      }
    },
    [userId, dia, toast],
  );

  /** Gramas ou unidades, conforme o jeito de medir do item. */
  const mudarQuantidade = useCallback(
    async (id: number, qtd: number) => {
      let antes: MealItem | undefined;
      setItens((l) =>
        l.map((i) => {
          if (i.id !== id) return i;
          antes = i;
          return i.unidades != null ? { ...i, unidades: qtd } : { ...i, gramas: qtd };
        }),
      );
      try {
        await updateMealItemQuantidade(id, antes?.unidades != null ? { unidades: qtd } : { gramas: qtd });
      } catch {
        setItens((l) => l.map((i) => (i.id === id && antes ? antes : i)));
        toast(ERRO);
      }
    },
    [toast],
  );

  const remover = useCallback(
    async (id: number) => {
      let tirado: { item: MealItem; pos: number } | undefined;
      setItens((l) => {
        const pos = l.findIndex((i) => i.id === id);
        if (pos >= 0) tirado = { item: l[pos], pos };
        return l.filter((i) => i.id !== id);
      });
      try {
        await deleteMealItem(id);
      } catch {
        if (tirado) {
          const t = tirado;
          setItens((l) => [...l.slice(0, t.pos), t.item, ...l.slice(t.pos)]);
        }
        toast(ERRO);
      }
    },
    [toast],
  );

  return { itens, carregado, erro, recarregar, adicionar, mudarQuantidade, remover };
}
