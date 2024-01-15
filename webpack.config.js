'use strict';
const path = require('path');

const outputDir = path.resolve(__dirname, 'dist');
let mode = 'development';
if (process.argv.indexOf('--mode=production') !== -1) {
  mode = 'production';
}

console.log('webpack mode: ' + mode);

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',
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
  mode: mode
}

module.exports = config;
