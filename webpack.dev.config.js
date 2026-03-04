const { merge } = require("webpack-merge");
const path = require("path");
const dotEnv = require("dotenv");
const baseConfig = require("./webpack.config");

dotEnv.config();

const commonPath =  process.env.COMMON_REPO_PATH || "";

module.exports = (webpackConfigEnv, argv) => {
  const config = baseConfig(webpackConfigEnv, argv);

  return merge(config, {
    resolve: {
      alias: {
        ...(commonPath && {
          "@saltbox/saltbox-frontend-common": path.resolve(__dirname, commonPath),
        }),
        // Force single dependency instance for the link compatibility
        "mobx": path.resolve(__dirname, "./node_modules/mobx"),
        "react": path.resolve(__dirname, "./node_modules/react"),
        "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
        "i18next": path.resolve(__dirname, "./node_modules/i18next"),
        "react-i18next": path.resolve(__dirname, "./node_modules/react-i18next"),
      },
    },
    module: {
      rules: [
        {
          test: /\.css$/,
          include: [
            commonPath && path.resolve(__dirname, commonPath),
          ].filter(notEmpty => !!notEmpty),
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
  });
};
