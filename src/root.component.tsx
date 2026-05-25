import { SaltboxLocaleProvider } from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";

import "@saltbox/saltbox-frontend-common/dist/saltbox-frontend-common.css";
import { FileBrowserPage } from "saltbox-filesystem/routes/browser";
import { i18nStore } from "saltbox-filesystem/store/i18n-store";
import { filesystemResources } from "saltbox-filesystem/store/i18n-resources";

export default observer(function Root() {
  return (
    <SaltboxLocaleProvider locale={i18nStore.currentLanguage} resources={filesystemResources}>
      <BrowserRouter basename="/filesystem">
        <Routes>
          <Route path="/browser/*" element={<FileBrowserPage />} />
          <Route path="*" element={<Navigate to="/browser/" replace />} />
        </Routes>
      </BrowserRouter>
    </SaltboxLocaleProvider>
  );
});
