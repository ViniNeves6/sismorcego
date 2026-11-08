// O app usa o SDK web do Firebase (firebase/app, auth, firestore). Os pacotes
// @react-native-firebase só seriam usados pelo push nativo, que está desligado
// (FIREBASE_PUSH_BACKEND_READY = false), e no iOS exigiriam GoogleService-Info.plist
// e frameworks estáticos. Ficam fora da compilação iOS; o Android não muda.
const iosDisabled = { platforms: { ios: null } };

module.exports = {
  dependencies: {
    '@react-native-firebase/app': iosDisabled,
    '@react-native-firebase/auth': iosDisabled,
    '@react-native-firebase/firestore': iosDisabled,
    '@react-native-firebase/messaging': iosDisabled,
  },
};
