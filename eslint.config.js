import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      'backend/drizzle/**',
      'backend/logs/**',
      'docs/.astro/**',
      'RealtimeWeatherReadingsacrossSingapore/**',
      'specs/**',
      '.specify/**',
      'e2e-artifacts/**',
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Express error handlers need all 4 params to be recognised, even if `next` is unused
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Frontend: React + browser
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { react },
    settings: { react: { version: 'detect' } },
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // TypeScript already checks prop types
      'react/prop-types': 'off',
    },
  },

  // Backend, scripts and root config: Node
  {
    files: ['backend/**/*.ts', 'scripts/**/*.mjs', '*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
  },

  // Must stay last: turns off rules that conflict with Prettier
  prettier,
);
