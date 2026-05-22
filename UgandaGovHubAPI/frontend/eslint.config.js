import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // The imported UI kit exports component helpers and variants from the same files.
      // Keeping Fast Refresh as a build-time requirement would force noisy file splits.
      'react-refresh/only-export-components': 'off',

      // React Compiler lint rules are too strict for the current prototype and third-party
      // UI patterns. TypeScript build remains the source of compile-time correctness.
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',

      // API payloads are still evolving, especially OpenAPI-driven JSON shapes.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
])
