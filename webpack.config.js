'use strict'
const path = require('path')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');


/** @type {import('webpack').Configuration} */
const config = {
	target: 'node', // TODO: recommended: 'webworker'
	node: false,
	mode: 'development',
	devtool: 'inline-source-map', // https://webpack.js.org/configuration/devtool/
	entry:  './src/extension.ts',
	output: {
		clean: true,
		path: path.resolve(__dirname, 'dist'),
		filename: 'extension.js',
		libraryTarget: 'commonjs2',
		devtoolModuleFilenameTemplate: 'file:///[absolute-resource-path]',
		devtoolFallbackModuleFilenameTemplate: 'file:///[absolute-resource-path]?[hash]',
	},
	externals: {
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed -> https://webpack.js.org/configuration/externals/
		vscode: 'commonjs vscode',
	},
	resolve: {
		// mainFields: ['browser', 'module', 'main'],
		extensions: ['.ts', '.js'],
		modules: ['src', 'node_modules'],
		plugins: [new TsconfigPathsPlugin({})] // alteratively use 'alias' in this config
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
