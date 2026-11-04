// O papel administrativo atual, também usado pelas regras do Firestore, é
// "coordenador". Papéis ausentes ou desconhecidos não concedem acesso.
export const canAccessCoordinatorArea = role => role === 'coordenador';
