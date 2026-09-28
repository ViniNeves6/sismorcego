// src/pages/Main/registroOptions.js
// Opções dos campos de seleção do registro. Os `value` são gravados no banco:
// não alterar sem migrar os dados existentes.

const NONE = { value: "", label: "Não informado" };

export const SEXO = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
];

export const TRATAMENTO = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

export const ANIMAL = [
  NONE,
  { value: "nao", label: "Não" },
  { value: "cao", label: "Cão" },
  { value: "gato", label: "Gato" },
  { value: "boi", label: "Boi" },
  { value: "porco", label: "Porco" },
  { value: "cavalo", label: "Cavalo" },
  { value: "aves", label: "Aves" },
];

export const CIRCUNSTANCIA = [
  NONE,
  { value: "pescando", label: "Pescando" },
  { value: "cacando", label: "Caçando" },
  { value: "lazer", label: "Lazer" },
];

export const POSSIVEL_ABRIGO = [
  NONE,
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
];

export const TIPO_ABRIGO = [
  NONE,
  { value: "madeira", label: "Casa de madeira sem forro" },
  { value: "alvenaria", label: "Casa de alvenaria sem forro" },
  { value: "alvenaria_forro", label: "Casa de alvenaria com forro" },
  { value: "lona", label: "Barraco de lona" },
  { value: "nao_tem", label: "Não tem" },
  { value: "outros", label: "Outros" },
];
