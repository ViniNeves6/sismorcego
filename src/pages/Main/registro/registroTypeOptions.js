// src/pages/Main/registro/registroTypeOptions.js
// Opções dos formulários por tipo de vítima. Os `value` são gravados no
// banco: não alterar sem migrar os dados existentes.

export const TIPOS_VITIMA = [
  { value: "humano", label: "Humano", icon: "user" },
  { value: "caninoFelino", label: "Canino / Felino", icon: "heart" },
  { value: "aves", label: "Aves", icon: "feather" },
  { value: "producao", label: "Animal de produção", icon: "package" },
];

export const SIM_NAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

// ===== Humano =====
export const CIRCUNSTANCIA_HUMANO = [
  { value: "em_casa_dormindo", label: "Em casa, dormindo" },
  { value: "praia", label: "Na praia" },
  { value: "barco", label: "No barco" },
  { value: "outro", label: "Outro" },
];

export const MOTIVO_NAO_BUSCOU = [
  { value: "distancia", label: "Distância" },
  { value: "falta_recurso", label: "Falta de recurso financeiro" },
  { value: "nao_se_importou", label: "Não se importou com o ocorrido" },
];

export const TIPO_ABRIGO_MORCEGO = [
  { value: "natural", label: "Natural" },
  { value: "artificial", label: "Artificial" },
];

// ===== Canino / Felino =====
export const ESPECIE_CANINO_FELINO = [
  { value: "canina", label: "Canina" },
  { value: "felina", label: "Felina" },
];

export const CIRCUNSTANCIA_CANINO_FELINO = [
  { value: "dormindo_fora_de_casa", label: "Dormindo fora de casa" },
  { value: "saiu_pescar_com_proprietario", label: "Saiu para pescar com o proprietário" },
  { value: "outro", label: "Outro" },
];

export const MOTIVO_NAO_PARTICIPOU_CANINO_FELINO = [
  { value: "outro", label: "Outro (descrever)" },
  { value: "nao_sabe", label: "Não sabe / não lembra" },
];

// ===== Aves =====
export const ESPECIE_AVES = [
  { value: "galinha", label: "Galinha" },
  { value: "pato", label: "Pato" },
  { value: "ave_silvestre", label: "Ave silvestre" },
];

export const CIRCUNSTANCIA_AVES = [
  { value: "no_galinheiro", label: "No galinheiro" },
  { value: "outro", label: "Outro" },
];

// ===== Animal de produção =====
export const ESPECIE_PRODUCAO = [
  { value: "bovino", label: "Bovino" },
  { value: "equino", label: "Equino" },
  { value: "suino", label: "Suíno" },
];

export const CIRCUNSTANCIA_PRODUCAO = [
  { value: "solto_pasto", label: "Solto no pasto" },
  { value: "chiqueiro_curral", label: "Chiqueiro/Curral" },
  { value: "outro", label: "Outro" },
];

export const PARTICIPOU_VACINACAO_PRODUCAO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
  { value: "nao_sabe", label: "Não sabe / não lembra" },
];

// ===== Compartilhado entre Canino/Felino, Aves e Produção =====
export const MOTIVO_NAO_AVISOU = [
  { value: "nao_sabia", label: "Não sabia" },
  { value: "nao_deu_importancia", label: "Não deu importância" },
  { value: "outro", label: "Outro" },
];

export const rotulo = (opcoes, valor) => opcoes.find((o) => o.value === valor)?.label ?? valor ?? "-";
