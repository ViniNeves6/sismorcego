/**
 * @format
 */

import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import App from './App';
import { name as appName } from './app.json';
import { auth, db } from './src/services/firebase';
import { executarChecagemNotificacoes } from './src/services/checagemNotificacoes';

AppRegistry.registerComponent(appName, () => App);

// Tarefa headless: roda mesmo com o app totalmente fechado (app "morto").
// Sem UI React montada, então resolve o usuário/papel diretamente.
const obterUsuarioAtual = () =>
  new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user || null);
    });
  });

const headlessTask = async (event) => {
  try {
    const user = await obterUsuarioAtual();
    if (user && db) {
      const perfil = await getDoc(doc(db, 'usuarios', user.uid));
      if (perfil.exists() && perfil.data()?.role === 'coordenador') {
        await executarChecagemNotificacoes(user.uid);
      }
    }
  } finally {
    BackgroundFetch.finish(event.taskId);
  }
};

BackgroundFetch.registerHeadlessTask(headlessTask);
