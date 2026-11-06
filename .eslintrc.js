module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [{
    files: ['scripts/provision-coordinator-device.cjs'],
    env: { node: true, es2021: true },
    parserOptions: { ecmaVersion: 2021 },
  }],
};
