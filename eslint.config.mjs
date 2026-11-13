import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import storybook from 'eslint-plugin-storybook';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/', '**/.next/', '**/storybook-static/', '**/next-env.d.ts', '!**/.storybook'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.{js,mjs,cjs}', '**/*.config.{ts,mts}'],
    languageOptions: { globals: globals.node },
  },
  storybook.configs['flat/recommended'],
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [nextPlugin.configs['core-web-vitals']],
    settings: { next: { rootDir: 'apps/web' } },
    rules: {
      // The app may only use library components; see CLAUDE.md.
      'no-restricted-imports': ['error', { patterns: ['@budget-kit/ui/src/*'] }],
    },
  },
);
