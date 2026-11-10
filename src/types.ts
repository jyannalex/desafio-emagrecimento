export type CorId = 'tangerina' | 'mirtilo' | 'framboesa' | 'menta' | 'uva' | 'turquesa';
/** Uma das cores prontas (CorId) ou uma cor livre '#rrggbb'. */
export type Cor = string;

export type Profile = { id: string; nome: string; meta_agua_ml: number; cor?: Cor | null };

export type Tarefa = 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'atividade';

export type Photo = { id: number; user_id: string; dia: string; tarefa: Tarefa; path: string; bytes: number };

export type Challenge = { id: 1; nome: string; data_inicio: string; data_fim: string; premio?: string | null };

export type DailyLog = {
  user_id: string;
  dia: string;
  cafe: boolean;
  almoco: boolean;
  lanche: boolean;
  jantar: boolean;
  nota_cafe: string | null;
  nota_almoco: string | null;
  nota_lanche: string | null;
  nota_jantar: string | null;
  nota_atividade: string | null;
  atividade: boolean;
  atividade_min: number;
  agua_ml: number;
  meta_agua_ml_do_dia: number;
};

export type Weight = { id: number; user_id: string; dia: string; kg: number };

export type Refeicao = 'cafe' | 'almoco' | 'lanche' | 'jantar';

export type Food = { id: number; nome: string; kcal_100g: number; origem: 'taco' | 'custom'; criado_por: string | null };

/** Item comido numa refeição. `nome` e `kcal_100g` são cópia do alimento no momento do registro. */
export type MealItem = {
  id: number;
  user_id: string;
  dia: string;
  refeicao: Refeicao;
  food_id: number | null;
  nome: string;
  kcal_100g: number;
  gramas: number;
};
