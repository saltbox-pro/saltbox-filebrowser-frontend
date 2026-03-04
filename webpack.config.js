const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");
const path = require("path");

module.exports = (webpackConfigEnv, argv) => {
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
    output: {
      filename: 'index.js',
    },
  });

  config.externals = [];

  return config;
};
