const RNFS = {
  DocumentDirectoryPath: '/docs',
  CachesDirectoryPath: '/cache',
  exists: async () => true,
  mkdir: async () => {},
  copyFile: async () => {},
  writeFile: async () => {},
  unlink: async () => {},
  readFile: async () => 'AAAA',
};
export default RNFS;
