// Runtime session material is stored in Android Keystore/iOS Keychain through
// the existing native dependency. Nothing is bundled as an account credential.
const storage = () => require('react-native-encrypted-storage').default;
export const secureEvaluationStorage = {
  getItem: key => storage().getItem(key),
  setItem: (key, value) => storage().setItem(key, value),
  removeItem: key => storage().removeItem(key),
};
