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

/** Medido por grama (kcal_100g) ou por unidade (kcal_unidade): sempre um dos dois. */
export type Food = { id: number; nome: string; kcal_100g: number | null; kcal_unidade: number | null; origem: 'taco' | 'custom'; criado_por: string | null };

/** Item comido numa refeição. `nome` e `kcal_100g` são cópia do alimento no momento do registro. */
export type MealItem = {
  id: number;
  user_id: string;
  dia: string;
  refeicao: Refeicao;
  food_id: number | null;
  nome: string;
  /** por grama: gramas + kcal_100g; por unidade: unidades + kcal_unidade */
  kcal_100g: number | null;
  gramas: number | null;
  unidades: number | null;
  kcal_unidade: number | null;
};

/** Ponto que pode ir para o VAR (o lanche não vale ponto). */
export type Ponto = 'cafe' | 'almoco' | 'jantar' | 'atividade' | 'agua';

export type VarLance = {
  id: number;
  alvo: string;
  autor: string;
  dia: string;
  ponto: Ponto;
  motivo: string;
  status: 'aberto' | 'aceito' | 'retirado';
  created_at: string;
};

export type VarMensagem = { id: number; lance_id: number; autor: string; texto: string; created_at: string };
