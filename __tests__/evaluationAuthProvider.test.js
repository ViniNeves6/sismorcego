import React, { StrictMode, useContext } from 'react';
import Renderer, { act } from 'react-test-renderer';
import EvaluationAuthProvider from '../src/hooks/EvaluationAuthProvider';
import AuthContext from '../src/hooks/authContext';
import { createEvaluationSession } from '../src/services/evaluationSession';

jest.mock('../src/services/firebase', () => ({ auth: {}, db: {}, app: { options: { projectId: 'demo-sismorcego-spark' } } }));
jest.mock('../src/services/appEnvironment', () => ({ USE_FIREBASE_EMULATORS: true }));
jest.mock('../src/services/evaluationSession', () => ({ createEvaluationSession: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => ({ fetch: jest.fn(), addEventListener: () => jest.fn() }));

let tree, context, sessions;
function Probe() { context = useContext(AuthContext); return null; }
beforeEach(() => {
  jest.useFakeTimers(); sessions = [];
  createEvaluationSession.mockImplementation(() => {
    let active = true, listener;
    const session = {
      subscribe: fn => { listener = fn; return () => { listener = null; }; },
      start: () => session.publish({ status: 'checking', user: null, role: null }),
      publish: state => { if (active) listener?.(state); },
      dispose: jest.fn(() => { active = false; }),
      revalidate: jest.fn(), setForeground: jest.fn(),
    };
    sessions.push(session); return session;
  });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; jest.useRealTimers(); });

test('effect replay keeps a live session, discards stale events and prohibits credential changes', async () => {
  await act(async () => { tree = Renderer.create(<StrictMode><EvaluationAuthProvider><Probe /></EvaluationAuthProvider></StrictMode>); });
  expect(context.user).toBeNull();
  expect(context.evaluation.status).toBe('checking');
  expect(context.provisionDevice).toBeUndefined();
  const live = sessions.at(-1), user = { uid: 'shared-coordinator' };
  await act(async () => live.publish({ status: 'ready', user, role: 'coordenador' }));
  expect(context.user).toEqual(user);
  for (const old of sessions.slice(0, -1)) {
    expect(old.dispose).toHaveBeenCalled();
    await act(async () => old.publish({ status: 'ready', user: { uid: 'stale' } }));
  }
  expect(context.user).toEqual(user);
  for (const action of ['signIn', 'signUp', 'resetPassword', 'signOut', 'updateUser']) {
    await expect(context[action]()).rejects.toThrow('gerenciada pela equipe');
  }
});
