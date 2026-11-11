// @react-native-community/geolocation → navigator.geolocation do navegador.
const geo = () => (typeof navigator !== 'undefined' ? navigator.geolocation : null);
export default {
  setRNConfiguration: () => {},
  requestAuthorization: (success) => success?.(),
  getCurrentPosition(success, error, options) {
    if (!geo()) { error?.({ code: 2, message: 'Localização indisponível neste navegador.' }); return; }
    geo().getCurrentPosition(success, error, options);
  },
  watchPosition: (success, error, options) => geo()?.watchPosition(success, error, options),
  clearWatch: id => geo()?.clearWatch(id),
  stopObserving: () => {},
};
