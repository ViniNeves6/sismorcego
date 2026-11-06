import { createEvaluationApi, validateEvaluationStatus } from '../src/services/evaluationApi';
jest.mock('../src/services/appEnvironment', () => ({ EVALUATION_ACCESS_URL: '' }));
const active = { version: 1, state: 'active', serverTime: 1000, startAt: 1, expiresAt: 10000, leaseMs: 60000 };
test('requests contain only protocol version and never a UID, password, installation code or credential', async () => {
  const fetcher = jest.fn(async () => ({ ok: true, text: async () => JSON.stringify({ ...active, uid: 'sismorcego-teste-coordenadores', customToken: 'header.payload.signature' }) }));
  const api = createEvaluationApi({ url: 'https://test.invalid/evaluationAccess', fetcher }); await api.status(); await api.issue();
  expect(fetcher.mock.calls[0][1].method).toBe('GET'); expect(fetcher.mock.calls[1][1].body).toBe('{"version":1}');
});
test.each([{ leaseMs: 60001 }, { serverTime: 20000 }, { startAt: 2000 }, { expiresAt: 'later' }, { state: 'ready' }, { version: 2 }])('invalid status %j cannot authorize UI', patch => {
  expect(() => validateEvaluationStatus({ ...active, ...patch })).toThrow();
});
test('missing service and rate limiting produce a safe error without leaking server responses', async () => {
  await expect(createEvaluationApi({ url: '' }).issue()).rejects.toMatchObject({ code: 'evaluation/unavailable' });
  await expect(createEvaluationApi({ url: 'https://test.invalid', fetcher: async () => ({ ok: false, status: 429 }) }).issue())
    .rejects.toMatchObject({ code: 'evaluation/rate-limited' });
});
