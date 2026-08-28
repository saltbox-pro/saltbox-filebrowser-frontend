import {
  SaltboxLocaleProvider,
  mountSingletonReactRoot,
  useFileBrowserMessages,
  useFileBrowserTransferNotification,
} from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { formatLocalFilesystemError } from "saltbox-filesystem/helpers/translate";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";
import { filesystemResources } from "saltbox-filesystem/store/i18n-resources";
import { i18nStore } from "saltbox-filesystem/store/i18n-store";

const OVERLAY_ELEMENT_ID = "saltbox-file-browser-transfer-overlay";

const FileBrowserFileTransferNoticePublisher = observer(
  function FileBrowserFileTransferNoticePublisher() {
    const { t } = useTranslation();
    const { uploadLabels } = useFileBrowserMessages();

    useFileBrowserTransferNotification({
      open: fileBrowserStore.uploadModalOpen,
      transfers: fileBrowserStore.uploads,
      onCancelTransfer: (id) => fileBrowserStore.cancelUpload(id),
      onClearFinished: () => fileBrowserStore.clearFinishedUploads(),
      formatError: (code) => formatLocalFilesystemError(t, code),
      noticeKey: "file-browser-page-upload",
      title: uploadLabels.title,
    });

    return null;
  }
);

const FileBrowserDownloadNoticePublisher = observer(function FileBrowserDownloadNoticePublisher() {
  const { t } = useTranslation();
  const { downloadLabels } = useFileBrowserMessages();

  useFileBrowserTransferNotification({
    open: false,
    transfers: fileBrowserStore.downloads,
    onCancelTransfer: (id) => fileBrowserStore.cancelDownload(id),
    onClearFinished: () => fileBrowserStore.clearFinishedDownloads(),
    formatError: (code) => formatLocalFilesystemError(t, code),
    noticeKey: "file-browser-page-download",
    title: downloadLabels.title,
  });

  return null;
});

const FileBrowserTransferOverlayApp = observer(function FileBrowserTransferOverlayApp() {
  return (
    <SaltboxLocaleProvider locale={i18nStore.currentLanguage} resources={filesystemResources}>
      <FileBrowserFileTransferNoticePublisher />
      <FileBrowserDownloadNoticePublisher />
    </SaltboxLocaleProvider>
  );
});

export function ensureFileBrowserTransferOverlayMounted(): void {
  mountSingletonReactRoot(OVERLAY_ELEMENT_ID, <FileBrowserTransferOverlayApp />);
}
