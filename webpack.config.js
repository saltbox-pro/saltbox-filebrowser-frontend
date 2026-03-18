const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");
const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const path = require("path");

module.exports = (webpackConfigEnv, argv) => {
  const isDev = argv.mode === "development";

  const defaultConfig = singleSpaDefaults({
    orgName: "saltbox",
    projectName: "filesystem",
    webpackConfigEnv,
    argv,
    outputSystemJS: false,
  });

  const config = merge(defaultConfig, {
    devServer: {
      port: 4206,
    },
    resolve: {
      alias: {
        "saltbox-filesystem": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [
      new MonacoWebpackPlugin({
        filename: "[name].worker.js",
        publicPath: isDev ? "http://localhost:4206/" : undefined,
      }),
    ],
    output: {
      filename: 'index.js',
    },
  });

  config.externals = [];

  return config;
};
