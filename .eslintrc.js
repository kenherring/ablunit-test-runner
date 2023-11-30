/**@type {import('eslint').Linter.Config} */
// eslint-disable-next-line no-undef
module.exports = {
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: [
		'@typescript-eslint',
	],
	"ignorePatterns": [
		".vscode-test/**"
	],
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/recommended',
	],
	rules: {
		// 'semi': [2, "any"],
		'@typescript-eslint/no-unused-vars': 0,
		'@typescript-eslint/no-explicit-any': 0,
		'@typescript-eslint/explicit-module-boundary-types': 0,
		'@typescript-eslint/no-non-null-assertion': 0,
		"@typescript-eslint/no-empty-function": 0,
		"@typescript-eslint/no-empty-interface": 0,
		"@typescript-eslint/no-var-requires": 0,
		"@typescript-eslint/no-this-alias": 0,
		"@typescript-eslint/no-namespace": 0,
		"@typescript-eslint/no-inferrable-types": 0,
		"@typescript-eslint/ban-types": 0
	}
}
