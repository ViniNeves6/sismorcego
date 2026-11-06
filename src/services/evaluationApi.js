import { EVALUATION_ACCESS_URL } from './appEnvironment';

const states = ['active', 'expired', 'suspended', 'not-started', 'blocked', 'unavailable'];
export function validateEvaluationStatus(data) {
  if (data?.version !== 1 || !states.includes(data.state) || !Number.isFinite(data.serverTime) ||
    (data.state === 'active' && (!Number.isFinite(data.startAt) || !Number.isFinite(data.expiresAt) ||
      data.startAt > data.serverTime || data.expiresAt <= data.serverTime || !Number.isFinite(data.leaseMs) || data.leaseMs <= 0 || data.leaseMs > 60000))) {
    throw Object.assign(new Error('Resposta de avaliação inválida.'), { code: 'evaluation/invalid-status' });
  }
  return data;
}
export function createEvaluationApi({ url = EVALUATION_ACCESS_URL, fetcher = fetch } = {}) {
  async function request(issue) {
    if (!url) throw Object.assign(new Error('Serviço de avaliação indisponível.'), { code: 'evaluation/unavailable' });
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetcher(url, { method: issue ? 'POST' : 'GET', signal: abort.signal,
        headers: { Accept: 'application/json', ...(issue ? { 'Content-Type': 'application/json' } : {}) },
        ...(issue ? { body: JSON.stringify({ version: 1 }) } : {}) });
      if (!response.ok) throw Object.assign(new Error('Serviço de avaliação indisponível.'), { code: response.status === 429 ? 'evaluation/rate-limited' : 'evaluation/unavailable' });
      const raw = await response.text();
      if (raw.length > 16384) throw new Error('Resposta inválida.');
      const data = validateEvaluationStatus(JSON.parse(raw));
      if (issue && data.state === 'active' && (data.uid !== 'sismorcego-teste-coordenadores' ||
        typeof data.customToken !== 'string' || data.customToken.length > 12000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(data.customToken))) throw new Error('Credencial inválida.');
      return data;
    } catch (error) {
      if (error?.code?.startsWith('evaluation/')) throw error;
      throw Object.assign(new Error('Não foi possível consultar a avaliação.'), { code: 'network/unavailable' });
    } finally { clearTimeout(timer); }
  }
  return { status: () => request(false), issue: () => request(true) };
}
