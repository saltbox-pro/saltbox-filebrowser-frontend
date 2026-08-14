import { createSingleSpaErrorBoundary } from "@saltbox/saltbox-frontend-common";
import { autorun, runInAction } from "mobx";
import React from "react";
import ReactDOMClient from "react-dom/client";
import singleSpaReact from "single-spa-react";

import Root from "./root.component";
import { appStore } from "./store/app-store";
import { envStore } from "./store/env-store";
import { i18nStore } from "./store/i18n-store";
import { ensureFileBrowserTransferOverlayMounted } from "./ui/file-browser-transfer-overlay";

const name = "saltbox-filesystem-frontend";
const path = "/filesystem";

const filesystemLifecycles = singleSpaReact({
  React,
  ReactDOMClient,
  rootComponent: Root,
  errorBoundary: createSingleSpaErrorBoundary("File Manager"),
  domElementGetter: () => document.getElementById("app-container"),
});

const plugins = {};

const init = (authStore, services, localeStore, pluginsStore) => {
  appStore.init(authStore, pluginsStore);
  runInAction(() => {
    for (const service of services) {
      envStore.services.set(service.service_name, service.env);
    }
  });
  autorun(() => {
    i18nStore.setLanguage(localeStore.currentLocale);
  });
  ensureFileBrowserTransferOverlayMounted();
};

export const settingsConfig = {
  priority: 50,
  key: "filesystem-module",
  label: "File Manager",
  children: [
    {
      key: "filesystem-browser",
      label: { en: "File Manager", ru: "Файловый менеджер" },
      icon: "folder_open",
      path: "/filesystem/browser",
    },
  ],
};

export const saltboxModule = {
  singleSpaLifecycle: filesystemLifecycles,
  name,
  path,
  plugins,
  settingsConfig,
  init,
};
