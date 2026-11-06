import path from 'path';
import fs from 'fs';
import os from 'os';
const { options, validateOptions, writePrivateFile } = require('../scripts/provision-coordinator-device.cjs');
const input = { uid: 'shared', installation: 'installation-1234567890123456', output: path.join(os.tmpdir(), 'evaluation-provision.json') };
test('the workstation tool cannot default to production or change accounts/roles', () => {
  expect(() => validateOptions({ ...input, project: 'sismorcego-50b25' }, {})).toThrow();
  expect(() => validateOptions({ ...input, emulator: true, project: 'demo-sismorcego-spark' }, {})).toThrow();
  expect(validateOptions({ ...input, emulator: true, project: 'demo-sismorcego-spark' }, {
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8088',
  })).toBeTruthy();
});
test('production files must be outside the source tree and explicitly target the approved project', () => {
  expect(validateOptions({ ...input, production: true, project: 'sismorcego-50b25' }, {})).toBeTruthy();
  expect(() => validateOptions({ ...input, production: true, project: 'other-project' }, {})).toThrow();
  expect(() => validateOptions({ ...input, production: true, project: 'sismorcego-50b25', output: path.resolve('src/provision.json') }, {})).toThrow();
  expect(() => validateOptions({ ...input, production: true, project: 'sismorcego-50b25', output: path.resolve('..secret') }, {})).toThrow();
});
test('private output never overwrites a pre-existing file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sismorcego-provision-test-'));
  const file = path.join(directory, 'fictitious.json');
  try {
    writePrivateFile(file, '{"fixture":true}'); expect(fs.readFileSync(file, 'utf8')).toBe('{"fixture":true}');
    expect(() => writePrivateFile(file, 'overwrite')).toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('{"fixture":true}');
    if (process.platform !== 'win32') expect(fs.statSync(file).mode % 0o1000).toBe(0o600);
  } finally { fs.unlinkSync(file); fs.rmdirSync(directory); }
});
test('unknown or incomplete command arguments fail before any credential request', () => {
  expect(() => options(['--uid'])).toThrow(); expect(() => options(['--unknown', 'value'])).toThrow();
  expect(options(['--emulator', '--uid', 'shared'])).toEqual({ emulator: true, uid: 'shared' });
});
