export default {
  requestAuthorization: async () => 'granted',
  getCurrentPosition(success) {
    setTimeout(() => success({ coords: { latitude: -1.7317, longitude: -47.8506, accuracy: 12 } }), 700);
  },
};
