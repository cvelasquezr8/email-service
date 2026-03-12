const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverage: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/main.(t|j)s',
    '!**/*.interface.ts',
    '!**/*.module.(t|j)s',
    '!**/*.config.(t|j)s',
    '!**/*.controller.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '.interface.ts',
    'index.ts$',
    '.module.ts$',
    'main.ts$',
    '.config.ts$',
    '.controller.ts$',
  ],
  testEnvironment: 'node',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
};
