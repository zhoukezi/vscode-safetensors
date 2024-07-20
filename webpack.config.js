//@ts-check

"use strict";

const path = require("path");
const { DefinePlugin } = require("webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: "node",
  mode: "development",

  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
  },
  externals: {
    vscode: "commonjs vscode",
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  devtool: "source-map",
  plugins: [new DefinePlugin({})],
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: "web",
  mode: "development",

  entry: "./src/Root.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "view.js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
    ],
  },
  devtool: "inline-source-map",
  infrastructureLogging: {
    level: "log",
  },
  plugins: [
    new DefinePlugin({}),
    new MiniCssExtractPlugin({
      filename: "view.css",
    }),
  ],
};

module.exports = [extensionConfig, webviewConfig];
