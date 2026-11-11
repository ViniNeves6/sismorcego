import { evaluationPeriod } from '../src/services/evaluationPolicy';
const timestamp = value => ({ toMillis: () => value });
const config = { enabled: true, startAt: timestamp(1000), expiresAt: timestamp(5000) };
test.each([[999,'not-started'],[1000,'active'],[4999,'active'],[5000,'expired']])('server-time boundary %s is %s', (now,state) => {
  expect(evaluationPeriod(config,now).state).toBe(state);
});
test.each([null,{}, {...config,enabled:'true'}, {...config,expiresAt:'tomorrow'}, {...config,startAt:timestamp(5000)}])('malformed configuration fails closed', data => {
  expect(evaluationPeriod(data,2000).state).toBe('unavailable');
});
test('disabled evaluation stays suspended even after its expiration', () => {
  expect(evaluationPeriod({...config,enabled:false},6000).state).toBe('suspended');
});
