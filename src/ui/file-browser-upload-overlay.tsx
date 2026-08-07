import {
  SaltboxLocaleProvider,
  mountSingletonReactRoot,
  useFileBrowserUploadNotification,
} from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { formatLocalFilesystemError } from "saltbox-filesystem/helpers/translate";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";
import { filesystemResources } from "saltbox-filesystem/store/i18n-resources";
import { i18nStore } from "saltbox-filesystem/store/i18n-store";

const OVERLAY_ELEMENT_ID = "saltbox-file-browser-upload-overlay";

const FileBrowserUploadNoticePublisher = observer(function FileBrowserUploadNoticePublisher() {
  const { t } = useTranslation();

  useFileBrowserUploadNotification({
    open: fileBrowserStore.uploadModalOpen,
    uploads: fileBrowserStore.uploads,
    onCancelUpload: (id) => fileBrowserStore.cancelUpload(id),
    onClearFinished: () => fileBrowserStore.clearFinishedUploads(),
    formatError: (code) => formatLocalFilesystemError(t, code),
    noticeKey: "file-browser-page-upload",
  });

  return null;
});

const FileBrowserUploadOverlayApp = observer(function FileBrowserUploadOverlayApp() {
  return (
    <SaltboxLocaleProvider locale={i18nStore.currentLanguage} resources={filesystemResources}>
      <FileBrowserUploadNoticePublisher />
    </SaltboxLocaleProvider>
  );
});

export function ensureFileBrowserUploadOverlayMounted(): void {
  mountSingletonReactRoot(OVERLAY_ELEMENT_ID, <FileBrowserUploadOverlayApp />);
}
