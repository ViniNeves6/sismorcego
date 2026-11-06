module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [{
    files: ['functions-evaluation/**/*.js'],
    env: { node: true, es2021: true },
    parserOptions: { ecmaVersion: 2021 },
  }],
};
