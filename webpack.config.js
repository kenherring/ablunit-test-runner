'use strict'
const path = require('path')

/** @type {import('webpack').Configuration} */
const config = {
	target: 'node', // TODO: recommended: 'webworker'
	node: false,
	mode: 'development',
	infrastructureLogging: {
		colors: false,
		appendOnly: true,
		level: 'log'
	},
	devtool: 'source-map', // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_tool-configuration
	// devtool: 'internal-source-map', // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_tool-configuration
	entry: {
		'extension': './src/extension.ts',
		'extension-insiders': './src/extension-insiders.ts',
	},
	output: {
		clean: true,
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].js',
		// library: { name: "extension", type: "commonjs" },
		libraryTarget: "commonjs2",
		// libraryTarget: "commonjs",
		devtoolModuleFilenameTemplate: "../[resource-path]",

	},
	externals: {
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed -> https://webpack.js.org/configuration/externals/
		vscode: "commonjs vscode",
		mocha: 'commonjs mocha',
		nyc: "commonjs nyc",
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'],
		extensions: ['.ts', '.js'],
		modules: ['src', 'node_modules']
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{
					loader: 'ts-loader',
					options: {
						compilerOptions: {
							"module": "es6" // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
						}
					}
				}]
			}
		]
	},
}

module.exports = config
