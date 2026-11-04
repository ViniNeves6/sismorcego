import Tts from 'react-native-tts';
import { createSpeechController } from '../src/services/accessibilitySpeech';

const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };
let controller, enabled, onError;
beforeEach(() => {
  jest.clearAllMocks();
  Tts.getInitStatus.mockResolvedValue(true);
  Tts.setDefaultLanguage.mockResolvedValue();
  Tts.stop.mockResolvedValue();
  Tts.speak.mockResolvedValue();
  enabled = true; onError = jest.fn();
  controller = createSpeechController({ canSpeak: () => enabled, onError });
});
afterEach(() => controller.dispose());

test('waits for the native engine and Portuguese voice before speaking', async () => {
  const init = deferred(); Tts.getInitStatus.mockReturnValueOnce(init.promise);
  const result = controller.speak('Painel. Total de registros: 3');
  expect(Tts.speak).not.toHaveBeenCalled(); expect(Tts.setDefaultLanguage).not.toHaveBeenCalled();
  init.resolve(true); expect(await result).toBe(true);
  expect(Tts.setDefaultLanguage).toHaveBeenCalledWith('pt-BR');
  expect(Tts.setDucking).toHaveBeenCalledWith(true);
  expect(Tts.stop.mock.invocationCallOrder[0]).toBeLessThan(Tts.speak.mock.invocationCallOrder[0]);
  expect(Tts.speak).toHaveBeenCalledWith('Painel. Total de registros: 3');
});

test.each(['mute', 'stop', 'dispose'])('%s cancels speech waiting for engine initialization', async action => {
  const init = deferred(); Tts.getInitStatus.mockReturnValueOnce(init.promise);
  const result = controller.speak('Não deve ser lido');
  if (action === 'mute') enabled = false;
  else if (action === 'stop') await controller.stop();
  else controller.dispose();
  init.resolve(true); expect(await result).toBe(false); expect(Tts.speak).not.toHaveBeenCalled();
});

test('only the latest announcement survives pending initialization', async () => {
  const init = deferred(); Tts.getInitStatus.mockReturnValueOnce(init.promise);
  const page = controller.speak('Registros');
  const popup = controller.speak('Detalhes do registro. Agente: Ana');
  init.resolve(true);
  expect(await page).toBe(false); expect(await popup).toBe(true);
  expect(Tts.speak).toHaveBeenCalledTimes(1);
  expect(Tts.speak).toHaveBeenCalledWith('Detalhes do registro. Agente: Ana');
});

test('reports missing engine and retries initialization on a later attempt', async () => {
  Tts.getInitStatus.mockRejectedValueOnce({ code: 'no_engine' });
  expect(await controller.speak('Registros')).toBe(false);
  expect(onError.mock.calls[0][0].message).toContain('Não há um mecanismo');
  expect(await controller.speak('Registros')).toBe(true);
  expect(Tts.getInitStatus).toHaveBeenCalledTimes(2);
});

test('reports an unavailable Portuguese voice instead of silently enabling speech', async () => {
  Tts.setDefaultLanguage.mockRejectedValueOnce({ code: 'lang_missing_data' });
  await expect(controller.initialize()).rejects.toThrow('A voz em português não está disponível');
  expect(Tts.speak).not.toHaveBeenCalled();
  await expect(controller.initialize()).resolves.toBeUndefined();
});

test('an engine failure does not leave an unhandled promise rejection', async () => {
  Tts.speak.mockRejectedValueOnce(new Error('audio unavailable'));
  expect(await controller.speak('Registros')).toBe(false);
  expect(onError).toHaveBeenCalledTimes(1);
});
