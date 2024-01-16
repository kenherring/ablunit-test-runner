'use strict';
const path = require('path');

const outputDir = path.resolve(__dirname, 'dist');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // recommended: 'webworker'
  node: false,
  entry: {
    'extension': './src/extension.ts'
  },
  output: {
    path: outputDir,
    filename: '[name].js',
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: 'source-map',
  externals: {
    // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed -> https://webpack.js.org/configuration/externals/
    vscode: "commonjs vscode"
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'],
    extensions: ['.ts', '.js']
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
  mode: 'development'
}

module.exports = config;
