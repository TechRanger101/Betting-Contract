module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  // extends: [
  //   // 'plugin:node/recommended',
  //   'eslint:recommended',
  //   'plugin:@typescript-eslint/recommended',
  //   'plugin:prettier/recommended',
  //   // 'prettier',
  // ],
  // plugins: ['@typescript-eslint'],
  // parser: '@typescript-eslint/parser',
  // parserOptions: {
  //   ecmaVersion: 12,
  //   project: 'tsconfig.json',
  // },
  rules: {
    'prettier/prettier': [
      'warn',
      {},
      {
        usePrettierrc: true,
      },
    ],
    // 'node/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
    // 'node/no-missing-import': 'off',
    // 'node/no-unsupported-features/node-builtins': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
    'no-unreachable': 'off',
    'prefer-const': 'off',
  },
  ignorePatterns: ['node_modules', 'artifacts', 'cache', 'coverage', '!.solcover.js'],
}
