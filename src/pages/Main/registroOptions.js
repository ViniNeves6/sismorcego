// src/pages/Main/registroOptions.js
// Opções compartilhadas entre as telas de registro. Os `value` são
// gravados no banco: não alterar sem migrar os dados existentes.
// As listas específicas de cada tipo de vítima ficam em
// src/pages/Main/registro/registroTypeOptions.js.

export const SEXO = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
];
