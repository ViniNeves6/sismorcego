// src/utils/formatters.js

// 🔹 Formata sexo: 1 = Masculino, 0 = Feminino
export const formatarSexo = (sexo) => {
  if (sexo === 1 || sexo === "1") return "Masculino";
  if (sexo === 0 || sexo === "0") return "Feminino";
  return "Não informado";
};

// 🔹 Formata tratamento: 1 = Sim, 0 = Não
export const formatarTratamentoAntirrabico = (valor) => {
  return valor === 1 || valor === "1" ? "Sim" : "Não";
};

// 🔹 Dicionários para tradução
const animaisAgredidos = {
  Boi: "Boi",
  Porco: "Porco",
  Cavalo: "Cavalo",
  Gato: "Gato",
  Aves: "Aves",
};

const circunstancias = {
  Pescando: "Pescando",
  Caçando: "Caçando",
  Lazer: "Lazer",
};

// 🔹 Formata listas (animais ou circunstâncias)
export const formatarLista = (lista, tipo) => {
  if (!Array.isArray(lista)) return "Não informado";

  return lista
    .map((item) => {
      if (tipo === "animal") return animaisAgredidos[item] || item;
      if (tipo === "circunstancia") return circunstancias[item] || item;
      return item;
    })
    .join(", ");
};
