import {
  SaltboxLocaleProvider,
  createModuleErrorBoundaryKit,
} from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router";

import "@saltbox/saltbox-frontend-common/dist/saltbox-frontend-common.css";
import { FileBrowserPage } from "saltbox-filesystem/routes/browser";
import { i18nStore } from "saltbox-filesystem/store/i18n-store";
import { filesystemResources } from "saltbox-filesystem/store/i18n-resources";

const MODULE_NAME = "File Manager";
const MAIN_PATH = "/browser/";

const { createRoutes } = createModuleErrorBoundaryKit({
  ErrorBoundary,
  moduleName: MODULE_NAME,
  homePath: MAIN_PATH,
  routing: { useNavigate, useLocation },
});

const filesystemRoutes = createRoutes(Route, [
  { path: `${MAIN_PATH}*`, element: <FileBrowserPage /> },
  { path: "*", element: <Navigate to={MAIN_PATH} replace /> },
]);

export default observer(function Root() {
  return (
    <SaltboxLocaleProvider locale={i18nStore.currentLanguage} resources={filesystemResources}>
      <BrowserRouter basename="/filesystem">
        <Routes>{filesystemRoutes}</Routes>
      </BrowserRouter>
    </SaltboxLocaleProvider>
  );
});
