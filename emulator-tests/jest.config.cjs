module.exports = {
  rootDir: '..', testEnvironment:'node', testMatch:['<rootDir>/emulator-tests/**/*.test.js'],
  transform:{ '^.+\\.js$':['babel-jest',{ presets:['module:@react-native/babel-preset'] }] },
  testTimeout:45000, maxWorkers:1,
};
