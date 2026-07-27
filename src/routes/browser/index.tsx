import {
  FileBrowserLayout,
  FileBrowserSourceAside,
  PageHeader,
  isGlobalServerError,
  joinFileBrowserPathChild,
} from "@saltbox/saltbox-frontend-common";
import { message, notification, Spin } from "antd";
import { observer } from "mobx-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileBrowser } from "saltbox-filesystem/components/file-browser/file-browser";
import { FileEditorModal } from "saltbox-filesystem/components/file-editor/file-editor-modal";
import { UploadModal } from "saltbox-filesystem/components/upload/upload-modal";
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
} from "saltbox-filesystem/helpers/run-browser-mutation";
import {
  formatFilesystemError,
  formatUnknownFilesystemError,
} from "saltbox-filesystem/helpers/translate";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

import styles from "./browser-page.module.css";

export const FileBrowserPage = observer(() => {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);

  const listingError = fileBrowserStore.error
    ? formatFilesystemError(t, tCommon, fileBrowserStore.error)
    : undefined;

  useEffect(() => {
    fileBrowserStore.loadSources().then((ok) => {
      if (ok) {
        return fileBrowserStore.loadDirectory();
      }
      return undefined;
    });
  }, []);

  const handleNavigate = useCallback((path: string) => {
    if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
      return;
    }
    fileBrowserStore.loadDirectory(undefined, path);
  }, []);

  const handleSourceChange = useCallback((source: string) => {
    if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
      return;
    }
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
      const key = `download-${name}`;
      const controller = new AbortController();

      if (
        fileBrowserStore.isMutating ||
        fileBrowserStore.hasActiveUploads ||
        fileEditorStore.isSaving
      ) {
        messageApi.error(formatFilesystemError(t, tCommon, "operation-busy"));
        return;
      }

      notificationApi.info({
        key,
        message: t("download.started"),
        description: name,
        placement: "bottomRight",
        duration: 0,
        icon: <Spin size="small" />,
        onClose: () => controller.abort(),
      });

      try {
        await fileBrowserStore.downloadItem(name, controller.signal);
        notificationApi.success({
          key,
          message: t("download.success"),
          description: name,
          placement: "bottomRight",
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          notificationApi.info({
            key,
            message: t("download.cancelled"),
            description: name,
            placement: "bottomRight",
          });
          return;
        }
        if (isGlobalServerError(error)) {
          notificationApi.destroy(key);
          return;
        }
        notificationApi.error({
          key,
          message: formatUnknownFilesystemError(t, tCommon, error, "download-error"),
          description: name,
          placement: "bottomRight",
        });
      }
    },
    [t, tCommon, messageApi, notificationApi]
  );

  const handleRename = useCallback(
    async (oldName: string, newName: string, kind: FileBrowserEntryKind) => {
      const kindKey = kind === "directory" ? "directory" : "file";
      await runNameMutation({
        run: () => fileBrowserStore.renameItem(oldName, newName, kind),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successMessage: tCommon(`file-browser.notifications.rename-${kindKey}-success`, {
          name: `${oldName} → ${newName}`,
        }),
        formatError: (error) => formatUnknownFilesystemError(t, tCommon, error, RENAME_ERROR_CODE),
        messageApi,
      });
    },
    [t, tCommon, messageApi]
  );

  const handleDelete = useCallback(
    async (name: string, kind: FileBrowserEntryKind) => {
      const kindKey = kind === "directory" ? "directory" : "file";
      await runToastMutation({
        run: () => fileBrowserStore.deleteItem(name, kind),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successMessage: tCommon(`file-browser.notifications.delete-${kindKey}-success`, { name }),
        formatError: (error) => formatUnknownFilesystemError(t, tCommon, error, REMOVE_ERROR_CODE),
        messageApi,
      });
    },
    [t, tCommon, messageApi]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      await runNameMutation({
        run: () => fileBrowserStore.createFolder(name),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successMessage: tCommon("file-browser.notifications.create-directory-success", { name }),
        formatError: (error) => formatUnknownFilesystemError(t, tCommon, error, CREATE_ERROR_CODE),
        messageApi,
      });
    },
    [t, tCommon, messageApi]
  );

  const handleCreateFile = useCallback(
    async (name: string) => {
      await runNameMutation({
        run: () => fileBrowserStore.createFile(name),
        reload: () => fileBrowserStore.reloadListingAfterMutation(),
        successMessage: tCommon("file-browser.notifications.create-file-success", { name }),
        formatError: (error) => formatUnknownFilesystemError(t, tCommon, error, CREATE_ERROR_CODE),
        messageApi,
      });
    },
    [t, tCommon, messageApi]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        await fileBrowserStore.uploadFile(file);
      } catch (error: unknown) {
        if (isGlobalServerError(error)) {
          if (fileBrowserStore.hasPendingListingReload) {
            scheduleListingReload(
              () => fileBrowserStore.reloadListingAfterMutation(),
              (reloadError) =>
                formatUnknownFilesystemError(t, tCommon, reloadError, "listing-reload-error"),
              messageApi
            );
          }
          return;
        }
        const code = resolveFilesystemErrorCode(error, "upload-chunk");
        if (code === "operation-busy" || code === "no-source" || code === "invalid-name") {
          messageApi.error(formatFilesystemError(t, tCommon, code));
        }
        if (fileBrowserStore.hasPendingListingReload) {
          scheduleListingReload(
            () => fileBrowserStore.reloadListingAfterMutation(),
            (reloadError) =>
              formatUnknownFilesystemError(t, tCommon, reloadError, "listing-reload-error"),
            messageApi
          );
        }
        return;
      }

      scheduleListingReload(
        () => fileBrowserStore.reloadListingAfterMutation(),
        (error) => formatUnknownFilesystemError(t, tCommon, error, "listing-reload-error"),
        messageApi
      );
    },
    [t, tCommon, messageApi]
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
            error={listingError}
            messageApi={messageApi}
            onNavigate={handleNavigate}
            onFileOpen={handleFileOpen}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRename={handleRename}
            onCreateFolder={handleCreateFolder}
            onCreateFile={handleCreateFile}
            onUploadClick={() => setUploadModalOpen(true)}
          />
        </FileBrowserLayout>
      </div>

      <UploadModal
        open={uploadModalOpen}
        disabled={fileEditorStore.isSaving}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        uploads={fileBrowserStore.uploads}
        onCancelUpload={(id) => fileBrowserStore.cancelUpload(id)}
        onClearFinished={() => fileBrowserStore.clearFinishedUploads()}
      />

      <FileEditorModal open={editorModalOpen} onClose={handleEditorClose} />
    </div>
  );
});
