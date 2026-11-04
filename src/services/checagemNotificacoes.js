// src/services/checagemNotificacoes.js
// Um único ponto de checagem, chamado tanto pelo app aberto (hook) quanto
// pela tarefa headless de segundo plano (index.js) — mesma lógica nos dois casos.
export async function executarChecagemNotificacoes() {
  // A geração pertence ao servidor. Não criar alertas nem reiniciar leituras no cliente.
  return { generated: 0, reason: 'server-integration-required' };
}
