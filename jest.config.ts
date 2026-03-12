import type { Config } from 'jest';
// Importamos el JSON directamente
import { compilerOptions } from './tsconfig.json';
import { pathsToModuleNameMapper } from 'ts-jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/main.(t|j)s',
    '!**/*.module.(t|j)s',
    '!**/*.config.(t|j)s',
    '!**/*.controller.(t|j)s',
  ],
  coverageDirectory: '../coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
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

export default config;
