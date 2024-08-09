'use strict'
const path = require('path')
const { sourceMapsEnabled } = require('process')

/** @type {import('webpack').Configuration} */
const config = {
	target: 'node', // TODO: recommended: 'webworker'
	// node: false,
	mode: 'development',
	devtool: 'source-map', // https://webpack.js.org/configuration/devtool/
	entry: {
		'extension': './src/extension.ts',
	},
	output: {
		clean: true,
		path: path.resolve(__dirname, 'dist'),
		filename: '[name].js',
		libraryTarget: 'commonjs',
		devtoolModuleFilenameTemplate: '../[resource-path]',
		// devtoolFallbackModuleFilenameTemplate: '[absolute-resource-path]',
		// devtoolModuleFilenameTemplate: '[absolute-resource-path]',
		// devtoolFallbackModuleFilenameTemplate: '[resource-path]',
	},
	externals: {
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed -> https://webpack.js.org/configuration/externals/
		vscode: 'commonjs vscode',
	},
	resolve: {
		mainFields: ['browser', 'module', 'main'],
		extensions: ['.ts', '.js'],
		modules: ['.', 'src', 'node_modules'],
	},
	module: {
		rules: [{
			test: /\.ts$/,
			exclude: /node_modules/,
			loader: 'ts-loader',
		}]
	},
}

module.exports = config
