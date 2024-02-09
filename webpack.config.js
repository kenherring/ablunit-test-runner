'use strict'
const path = require('path')
const outputDir = path.resolve(__dirname, 'dist')

/** @type {import('webpack').Configuration} */
const config = {
	target: 'node', // TODO: recommended: 'webworker'
	node: false,
	mode: 'development',
	entry: {
		'extension': './src/extension.ts',
		'extension-insiders': './src/extension-insiders.ts',
		'test/index': './test/index.ts',
		'test/createTestConfig': './test/createTestConfig.ts',
		'test/suite/DebugLines.test': './test/suite/DebugLines.test.ts',
	},
	output: {
		path: outputDir,
		filename: '[name].js',
		libraryTarget: "commonjs", // TODO: "commonjs2" ?
		devtoolModuleFilenameTemplate: "../[resource-path]",
	},
	devtool: 'source-map', // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_tool-configuration
	externals: {
		// the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed -> https://webpack.js.org/configuration/externals/
		vscode: "commonjs vscode",
		mocha: "commonjs mocha",
		nyc: "commonjs nyc"
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
	}
}

module.exports = config
