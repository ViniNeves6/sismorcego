const asset = { uri: 'file:///preview/foto.jpg', type: 'image/jpeg', base64: 'AAAA' };
export const launchCamera = (_o, cb) => setTimeout(() => cb({ assets: [asset] }), 300);
export const launchImageLibrary = (_o, cb) => setTimeout(() => cb({ assets: [asset] }), 300);
