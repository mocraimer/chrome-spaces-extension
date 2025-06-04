const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const config: import('webpack').Configuration = {
  devtool: 'source-map',
  mode: 'development', // Force development mode to disable minification
  entry: {
    popup: path.join(__dirname, '/src/popup/simple-index.tsx'),
    options: path.join(__dirname, '/src/options/index.tsx'),
    background: path.join(__dirname, '/src/background/index.ts'),
  },
  output: {
    path: path.join(__dirname, 'build'),
    filename: '[name].js',
    clean: true, // Clean the output directory before emit
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src/'),
    },
  },
  optimization: {
    minimize: false, // Disable minification completely
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/popup/index.html'),
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/options/index.html'),
      filename: 'options.html',
      chunks: ['options'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/devtools/performance-panel.html'),
      filename: 'devtools/performance-panel.html',
      chunks: ['options'],
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'src/devtools/devtools.html'),
      filename: 'devtools/devtools.html',
      chunks: ['options'],
    }),
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'icons', to: 'icons' },
        // Don't copy source maps in production
      ],
    }),
  ],
};

module.exports = config;
