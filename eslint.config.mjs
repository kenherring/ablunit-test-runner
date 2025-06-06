import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import ts from 'typescript-eslint'
import promise from 'eslint-plugin-promise'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


export default defineConfig([
	{
		ignores: [
			'.vscode-test/**',
			'.worktrees/**',
			'esbuild.js',
			'dist/**',
			'dummy-ext/',
			'resources/ADE/**',
			'test_projects/',
		],
	},
	js.configs.recommended,
	ts.configs.strictTypeChecked,
	ts.configs.stylisticTypeChecked,
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	promise.configs['flat/recommended'],
	{

		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: '.',
			},
		},

		rules: {
			// '@stylistic/indent': ['error', 'tab'],

			// '@stylistic/comma-spacing': ['warn', {
			// 	before: false,
			// 	after: true,
			// }],

			// '@stylistic/no-extra-parens': 'warn',

			'@typescript-eslint/no-restricted-types': ['error', {
				types: {
					Object: 'Use {} instead.',
					String: 'Use "string" instead.',
					Number: 'Use "number" instead.',
					Boolean: 'Use "boolean" instead.',
				},
			}],

			'@typescript-eslint/naming-convention': ['error', {
				selector: 'interface',
				format: ['PascalCase'],
				custom: {
					regex: '^I[A-Z]',
					match: true,
				},
			}],

			'@typescript-eslint/no-confusing-non-null-assertion': 'warn',

			'@typescript-eslint/no-floating-promises': ['error', {
				checkThenables: true,
			}],

			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-non-null-assertion': 0,
			'@typescript-eslint/no-unnecessary-condition': 0,
			'no-unused-vars': 'off',

			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'args': 'all',
					'argsIgnorePattern': '^_',
					'caughtErrors': 'all',
					'caughtErrorsIgnorePattern': '^_',
					'destructuredArrayIgnorePattern': '^_',
					'varsIgnorePattern': '^_',
					'ignoreRestSiblings': true,
				}
			],

			'@typescript-eslint/prefer-readonly': 'warn',
			'@typescript-eslint/restrict-plus-operands': 'off',
			'@typescript-eslint/return-await': ['error', 'always'],
			'@typescript-eslint/switch-exhaustiveness-check': ['warn', {
				considerDefaultExhaustiveForUnions: true,
			}],
			'promise/catch-or-return': ['warn', {
				allowThen: true,
			}],
			'promise/no-callback-in-promise': 'off',

			'promise/always-return': ['warn', {
				ignoreLastCallback: true
			}],

			'no-console': 'warn',
			'no-empty': 'warn',
			'no-mixed-spaces-and-tabs': ['error', 'smart-tabs'],

			'prefer-promise-reject-errors': 'error',
			quotes: ['warn', 'single'],
			semi: ['error', 'never'],
			'require-await': 'error',
			'space-before-blocks': ['error', 'always'],
			'space-before-function-paren': ['warn', 'always'],
			'space-in-parens': ['warn', 'never'],

			'spaced-comment': ['error', 'always', {
				markers: ['/'],
			}],
		},
	}
])
