import {
  FileBrowserLayout,
  FileBrowserSourceAside,
  FileBrowserUploadModal,
  PageHeader,
  dismissFileBrowserToast,
  isGlobalServerError,
  joinFileBrowserPathChild,
  runWithFileBrowserDownloadNotification,
  useFileBrowserNotificationToasts,
} from "@saltbox/saltbox-frontend-common";
import { message, notification } from "antd";
import { observer } from "mobx-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileBrowser } from "saltbox-filesystem/components/file-browser/file-browser";
import { FileEditorModal } from "saltbox-filesystem/components/file-editor/file-editor-modal";
import {
  CREATE_ERROR_CODE,
  REMOVE_ERROR_CODE,
  RENAME_ERROR_CODE,
  resolveFilesystemErrorCode,
  type FileBrowserEntryKind,
} from "saltbox-filesystem/helpers/filesystem-error";
import {
  runNameMutation,
  runToastMutation,
  scheduleListingReload,
  type MutationNotify,
} from "saltbox-filesystem/helpers/run-browser-mutation";
import {
  formatLocalFilesystemError,
  resolveFilesystemErrorText,
} from "saltbox-filesystem/helpers/translate";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

import styles from "./browser-page.module.css";

export const FileBrowserPage = observer(() => {
  const { t } = useTranslation();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const toasts = useFileBrowserNotificationToasts(messageApi);
  const { showLocalError, showSuccessByKey, translateError, downloadLabels } = toasts;
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);

  const resolveErrorText = useCallback(
    (code: string) => resolveFilesystemErrorText(translateError, t, code),
    [t, translateError]
  );

  const notify = useMemo<MutationNotify>(
    () => ({
      showLocalError,
      showSuccessByKey,
      resolveErrorText,
    }),
    [showLocalError, showSuccessByKey, resolveErrorText]
  );

  const listingError = fileBrowserStore.error
    ? resolveErrorText(fileBrowserStore.error)
    : undefined;

  useEffect(() => {
    fileBrowserStore.loadSources().then((ok) => {
      if (ok) {
        return fileBrowserStore.loadDirectory();
      }
      return undefined;
    });
  }, []);

  const sourceReadOnly = fileBrowserStore.isCurrentSourceReadOnly;

  useEffect(() => {
    if (sourceReadOnly) {
      setUploadModalOpen(false);
    }
  }, [sourceReadOnly]);

  const handleNavigate = useCallback((path: string) => {
    if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
      return;
    }
    setEditorModalOpen(false);
    fileEditorStore.reset();
    fileBrowserStore.loadDirectory(undefined, path);
  }, []);

  const handleReload = useCallback((): Promise<void> => {
    if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
      return Promise.resolve();
    }
    dismissFileBrowserToast(messageApi);
    return fileBrowserStore.loadDirectory();
  }, [messageApi]);

  const handleSourceChange = useCallback((source: string) => {
    if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
      return;
    }
    setEditorModalOpen(false);
    fileEditorStore.reset();
    fileBrowserStore.loadDirectory(source, "/");
  }, []);

  const handleFileOpen = useCallback((name: string) => {
    if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
      return;
    }
    const fullPath = joinFileBrowserPathChild(fileBrowserStore.currentPath, name);
    fileEditorStore.loadFile(fileBrowserStore.currentSource, fullPath);
    setEditorModalOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorModalOpen(false);
    fileEditorStore.reset();
  }, []);

  const handleDownload = useCallback(
    async (name: string) => {
      if (
        fileBrowserStore.isMutating ||
        fileBrowserStore.hasActiveUploads ||
        fileEditorStore.isSaving
      ) {
        showLocalError(resolveErrorText("operation-busy"));
        return;
      }

      await runWithFileBrowserDownloadNotification({
        notificationApi,
        itemName: name,
        itemPath: joinFileBrowserPathChild(fileBrowserStore.currentPath, name),
        labels: downloadLabels,
        formatError: (error) =>
          resolveErrorText(resolveFilesystemErrorCode(error, "download-error")),
        download: (signal) => fileBrowserStore.downloadItem(name, signal),
      });
    },
    [notificationApi, showLocalError, resolveErrorText, downloadLabels]
  );

  const handleRename = useCallback(
    async (oldName: string, newName: string, kind: FileBrowserEntryKind) => {
      const kindKey = kind === "directory" ? "directory" : "file";
      await runNameMutation({
        run: () => fileBrowserStore.renameItem(oldName, newName, kind),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successKey: kindKey === "directory" ? "rename-directory-success" : "rename-file-success",
        successParams: { name: `${oldName} → ${newName}` },
        notify,
        fallbackErrorCode: RENAME_ERROR_CODE,
      });
    },
    [notify]
  );

  const handleDelete = useCallback(
    async (name: string, kind: FileBrowserEntryKind) => {
      const kindKey = kind === "directory" ? "directory" : "file";
      await runToastMutation({
        run: () => fileBrowserStore.deleteItem(name, kind),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successKey: kindKey === "directory" ? "delete-directory-success" : "delete-file-success",
        successParams: { name },
        notify,
        fallbackErrorCode: REMOVE_ERROR_CODE,
      });
    },
    [notify]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      await runNameMutation({
        run: () => fileBrowserStore.createFolder(name),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successKey: "create-directory-success",
        successParams: { name },
        notify,
        fallbackErrorCode: CREATE_ERROR_CODE,
      });
    },
    [notify]
  );

  const handleCreateFile = useCallback(
    async (name: string) => {
      await runNameMutation({
        run: () => fileBrowserStore.createFile(name),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successKey: "create-file-success",
        successParams: { name },
        notify,
        fallbackErrorCode: CREATE_ERROR_CODE,
      });
    },
    [notify]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        await fileBrowserStore.uploadFile(file);
      } catch (error: unknown) {
        if (isGlobalServerError(error)) {
          if (fileBrowserStore.hasPendingListingReload) {
            scheduleListingReload(() => fileBrowserStore.reloadListingAfterMutation(), notify);
          }
          return;
        }
        const code = resolveFilesystemErrorCode(error, "upload-chunk");
        if (code === "operation-busy" || code === "no-source" || code === "invalid-name") {
          showLocalError(resolveErrorText(code));
        }
        if (fileBrowserStore.hasPendingListingReload) {
          scheduleListingReload(() => fileBrowserStore.reloadListingAfterMutation(), notify);
        }
        return;
      }

      dismissFileBrowserToast(messageApi);
      scheduleListingReload(() => fileBrowserStore.reloadListingAfterMutation(), notify);
    },
    [messageApi, notify, resolveErrorText, showLocalError]
  );

  const browserLocked = fileBrowserStore.isBusy || fileEditorStore.isSaving;

  return (
    <div className={styles.page}>
      {messageContextHolder}
      {notificationContextHolder}
      <PageHeader title={t("browser.title")} />

      <div className={styles.content}>
        <FileBrowserLayout
          sidebar={
            <FileBrowserSourceAside
              items={fileBrowserStore.sources.map((source) => ({
                key: source.name,
                label: source.name,
              }))}
              selectedKey={fileBrowserStore.currentSource}
              loading={fileBrowserStore.sourcesLoading}
              disabled={browserLocked}
              onChange={handleSourceChange}
            />
          }
        >
          <FileBrowser
            currentPath={fileBrowserStore.currentPath}
            files={fileBrowserStore.files}
            isLoading={fileBrowserStore.isLoading}
            disabled={browserLocked}
            readOnly={sourceReadOnly}
            error={listingError}
            toasts={toasts}
            onNavigate={handleNavigate}
            onFileOpen={handleFileOpen}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRename={handleRename}
            onCreateFolder={handleCreateFolder}
            onCreateFile={handleCreateFile}
            onUploadClick={() => setUploadModalOpen(true)}
            onReload={handleReload}
          />
        </FileBrowserLayout>
      </div>

      <FileBrowserUploadModal
        open={uploadModalOpen}
        disabled={fileEditorStore.isSaving || sourceReadOnly}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        uploads={fileBrowserStore.uploads}
        onCancelUpload={(id) => fileBrowserStore.cancelUpload(id)}
        onClearFinished={() => fileBrowserStore.clearFinishedUploads()}
        formatError={(code) => formatLocalFilesystemError(t, code)}
      />

      <FileEditorModal
        open={editorModalOpen}
        readOnly={fileBrowserStore.isSourceReadOnly(fileEditorStore.source)}
        onClose={handleEditorClose}
        toasts={toasts}
      />
    </div>
  );
});
