// Ponto de entrada web: o mesmo App.js do aplicativo, renderizado pelo react-native-web.
import { Buffer } from 'buffer';
import { AppRegistry } from 'react-native';
import App from '../App';

globalThis.Buffer = globalThis.Buffer || Buffer;
AppRegistry.registerComponent('Sismorcego', () => App);
AppRegistry.runApplication('Sismorcego', { rootTag: document.getElementById('root') });
