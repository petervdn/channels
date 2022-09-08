/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  modulePathIgnorePatterns: ['dist'],
  setupFilesAfterEnv: ['<rootDir>/src/testing/setupTests.ts'],
};
