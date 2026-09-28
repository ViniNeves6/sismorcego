// Dados fictícios da prévia.
const day = (n) => new Date(Date.now() - n * 86400000).toISOString();

export const localRegistros = [
  {
    recordId: 'demo-1', uid: 'demo', status: 'pending', retryCount: 0,
    nomeAcs: 'Maria Souza', nomeAgredido: 'João Batista', apelido: 'Joãozinho', idade: 34, sexo: 'M',
    tratamentoAntirrabico: 'nao', municipio: 'Curuçá', animalAgredido: 'cao', circunstancia: 'pescando',
    possivelAbrigo: 'sim', abrigoOpcao: 'madeira', dataRegistro: day(1), dataAgressao: day(2), createdAt: day(1),
    location: { latitude: -0.7315, longitude: -47.8506, accuracy: 14, isHighAccuracy: true },
    photoUriLocal: 'file:///preview/foto.jpg', photoBase64: 'AAAA',
  },
  {
    recordId: 'demo-2', uid: 'demo', status: 'failed', retryCount: 3, lastError: 'Sem conexão',
    nomeAcs: 'Maria Souza', nomeAgredido: 'Ana Lima', idade: 27, sexo: 'F',
    tratamentoAntirrabico: 'sim', municipio: 'Marapanim', animalAgredido: 'gato', circunstancia: 'lazer',
    dataRegistro: day(3), dataAgressao: day(4), createdAt: day(3),
  },
];

export const nuvemRegistros = [
  {
    id: 'demo-3', recordId: 'demo-3', status: 'synced',
    nomeAcs: 'Carlos Pereira', nomeAgredido: 'Rita Ferreira', idade: 51, sexo: 'F', tratamentoAntirrabico: 'sim',
    municipio: 'Belém', animalAgredido: 'cao', dataRegistro: day(8), dataAgressao: day(9), createdAt: day(8),
    photoBase64: 'AAAA',
  },
  {
    id: 'demo-4', recordId: 'demo-4', status: 'synced',
    nomeAcs: 'Carlos Pereira', nomeAgredido: 'Pedro Alves', idade: 19, sexo: 'M', tratamentoAntirrabico: 'nao',
    municipio: 'Salinópolis', animalAgredido: 'boi', dataRegistro: day(15), dataAgressao: day(15), createdAt: day(15),
  },
];

export const duvidas = [
  {
    id: 'd1', titulo: 'Como registro uma agressão sem internet?',
    resposta: 'Preencha o formulário normalmente e toque em Salvar registro. Ele fica guardado no aparelho e é enviado sozinho quando houver conexão.',
    createdAt: { seconds: 1700000400 },
  },
  {
    id: 'd2', titulo: 'O que significa o status Pendente?',
    resposta: 'O registro está salvo no seu aparelho, mas ainda não foi enviado ao servidor. Ele segue para a nuvem assim que a internet voltar.',
    createdAt: { seconds: 1700000300 },
  },
  {
    id: 'd3', titulo: 'Posso gerar a ficha sem mostrar nomes?',
    resposta: 'Sim. Em Buscar, toque no registro e escolha “Sem nomes” ou “Sem localização” antes de gerar o PDF.',
    createdAt: { seconds: 1700000200 },
  },
  {
    id: 'd4', titulo: 'A localização é exata?',
    resposta: 'Ela depende do sinal de GPS. O app mostra a precisão estimada; em área aberta e com o GPS ativado o resultado costuma ser melhor.',
    createdAt: { seconds: 1700000100 },
  },
];
