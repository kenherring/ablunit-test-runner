'use strict'
const path = require('path')

/** @type {import('webpack').Configuration} */
const config = {
	target: 'node', // TODO: recommended: 'webworker'
	node: false,
	mode: 'development',
	devtool: 'source-map', // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_tool-configuration
	entry: {
		'extension': './src/extension.ts',
		'extension-insiders': './src/extension-insiders.ts',
	},
	output: {
		clean: true,
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].js',
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: '../[resource-path]',
	},
	externals: {
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed -> https://webpack.js.org/configuration/externals/
		vscode: 'commonjs vscode',
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'],
		extensions: ['.ts', '.js'],
		modules: ['node_modules', 'src']
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			use: [{
				loader: 'ts-loader',
			}]
		}]
	},
}

module.exports = config
