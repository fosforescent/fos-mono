/* eslint no-undef: 0 */
/* eslint @typescript-eslint/no-var-requires: 0 */

const customJestConfig = {
  verbose: true,
  setupFilesAfterEnv: ['./jest/setupTests.ts'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx'],
  moduleDirectories: ['node_modules', 'src' ],
  moduleNameMapper: {
    '\\.(less|scss)$': 'identity-obj-proxy',
    '\\.(css)$': 'jest-css-modules',
    "@/(.*)": "<rootDir>/$1",
  },
  transform: {
    '^.+\\.(ts|tsx)?$': ['ts-jest', {
      "babelConfig": true,
    }],
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  testEnvironment: 'jest-environment-jsdom',
  preset: "ts-jest",
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)', 
  ],
  testPathIgnorePatterns: [
    'node_modules',
    'e2e/'
  ],
}
module.exports = customJestConfig
