// @ts-check

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/__mocks__/styleMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx)$': '<rootDir>/src/test/importMetaTransformer.cjs',
  },
};
