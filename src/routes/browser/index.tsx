import {
  BrowserFileDownloadAbortError,
  ErrorZone,
  FileBrowserLayout,
  FileBrowserSourceAside,
  FileBrowserUploadModal,
  PageHeader,
  abortBrowserFileDownloadTarget,
  createBrowserFileDownloadTarget,
  dismissFileBrowserToast,
  isAbortError,
  joinFileBrowserPathChild,
  useFileBrowserNotificationToasts,
} from "@saltbox/saltbox-frontend-common";
import { message } from "antd";
import { observer } from "mobx-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileBrowser } from "saltbox-filesystem/components/file-browser/file-browser";
import { FileEditorModal } from "saltbox-filesystem/components/file-editor/file-editor-modal";
import {
  resolveFilesystemErrorCode,
  type FileBrowserEntryKind,
} from "saltbox-filesystem/helpers/filesystem-error";
import { runModalMutation } from "saltbox-filesystem/helpers/run-modal-mutation";
import {
  formatLocalFilesystemError,
  resolveFilesystemErrorText,
} from "saltbox-filesystem/helpers/translate";
import { useFileBrowserPageLocation } from "saltbox-filesystem/hooks/use-file-browser-page-location";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

import styles from "./browser-page.module.css";

export const FileBrowserPage = observer(() => {
  const { t } = useTranslation();
  const { t: tCommon } = useTranslation("common");
  const [messageApi, messageContextHolder] = message.useMessage();
  const toasts = useFileBrowserNotificationToasts(messageApi);
  const { showLocalError, showErrorByCode, translateError } = toasts;
  const uploadModalOpen = fileBrowserStore.uploadModalOpen;
  const setUploadModalOpen = useCallback((open: boolean) => {
    fileBrowserStore.setUploadModalOpen(open);
  }, []);
  const [editorModalOpen, setEditorModalOpen] = useState(false);

  const resolveErrorText = useCallback(
    (code: string) => resolveFilesystemErrorText(translateError, t, code),
    [t, translateError]
  );

  const reloadListing = useCallback(() => {
    return fileBrowserStore.reloadListingAfterMutation();
  }, []);

  useEffect(() => {
    return () => {
      fileBrowserStore.setUploadModalOpen(false);
    };
  }, []);

  const closeUploadModal = () => {
    setUploadModalOpen(false);
  };

  const sourceReadOnly = fileBrowserStore.isCurrentSourceReadOnly;

  useEffect(() => {
    if (sourceReadOnly) {
      setUploadModalOpen(false);
    }
  }, [setUploadModalOpen, sourceReadOnly]);

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

  useFileBrowserPageLocation({
    currentPath: fileBrowserStore.currentPath,
    currentSource: fileBrowserStore.currentSource,
    editorOpen: editorModalOpen,
    editorFileName: fileEditorStore.fileName,
    onOpenFile: handleFileOpen,
    showErrorByCode,
  });

  const handleDownload = useCallback(
    async (name: string) => {
      if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
        showLocalError(resolveErrorText("operation-busy"));
        return;
      }

      const pinnedLocation = {
        source: fileBrowserStore.currentSource,
        directoryPath: fileBrowserStore.currentPath,
      };
      const claim = fileBrowserStore.claimDownload(name, pinnedLocation);
      if (claim.ok === false) {
        showLocalError(resolveErrorText(claim.error));
        return;
      }

      let browserFileTarget;
      try {
        browserFileTarget = await createBrowserFileDownloadTarget(name);
      } catch (error) {
        fileBrowserStore.abandonDownloadClaim(claim.downloadId);
        if (error instanceof BrowserFileDownloadAbortError) {
          return;
        }
        showLocalError(resolveErrorText("download-error"));
        return;
      }

      const claimed = fileBrowserStore.downloads.get(claim.downloadId);
      if (claimed == null || claimed.status === "error" || claim.abortController.signal.aborted) {
        abortBrowserFileDownloadTarget(browserFileTarget);
        fileBrowserStore.finalizeUnstartedDownload(claim.downloadId);
        return;
      }

      if (fileBrowserStore.isBusy || fileEditorStore.isSaving) {
        abortBrowserFileDownloadTarget(browserFileTarget);
        fileBrowserStore.abandonDownloadClaim(claim.downloadId);
        showLocalError(resolveErrorText("operation-busy"));
        return;
      }

      await fileBrowserStore
        .downloadItem(claim.downloadId, name, browserFileTarget, pinnedLocation)
        .catch(() => undefined);
    },
    [showLocalError, resolveErrorText]
  );

  const handleRename = useCallback(
    async (oldName: string, newName: string, kind: FileBrowserEntryKind) => {
      const kindKey = kind === "directory" ? "directory" : "file";
      await runModalMutation({
        run: () => fileBrowserStore.renameItem(oldName, newName, kind),
        successMessage: tCommon(
          kindKey === "directory"
            ? "file-browser.notifications.rename-directory-success"
            : "file-browser.notifications.rename-file-success",
          { name: `${oldName} → ${newName}` }
        ),
        errorFallback: t("errors.renameFailed"),
        reload: reloadListing,
        resolveClientError: resolveErrorText,
      });
    },
    [reloadListing, resolveErrorText, t, tCommon]
  );

  const handleDelete = useCallback(
    async (name: string, kind: FileBrowserEntryKind) => {
      const kindKey = kind === "directory" ? "directory" : "file";
      await runModalMutation({
        run: () => fileBrowserStore.deleteItem(name, kind),
        successMessage: tCommon(
          kindKey === "directory"
            ? "file-browser.notifications.delete-directory-success"
            : "file-browser.notifications.delete-file-success",
          { name }
        ),
        errorFallback: t("errors.deleteFailed"),
        reload: reloadListing,
        resolveClientError: resolveErrorText,
      });
    },
    [reloadListing, resolveErrorText, t, tCommon]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      await runModalMutation({
        run: () => fileBrowserStore.createFolder(name),
        successMessage: tCommon("file-browser.notifications.create-directory-success", { name }),
        errorFallback: t("errors.createFolderFailed"),
        reload: reloadListing,
        resolveClientError: resolveErrorText,
      });
    },
    [reloadListing, resolveErrorText, t, tCommon]
  );

  const handleCreateFile = useCallback(
    async (name: string) => {
      await runModalMutation({
        run: () => fileBrowserStore.createFile(name),
        successMessage: tCommon("file-browser.notifications.create-file-success", { name }),
        errorFallback: t("errors.createFileFailed"),
        reload: reloadListing,
        resolveClientError: resolveErrorText,
      });
    },
    [reloadListing, resolveErrorText, t, tCommon]
  );

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        await fileBrowserStore.uploadFile(file);
      } catch (error: unknown) {
        if (isAbortError(error)) {
          if (fileBrowserStore.hasPendingListingReload) {
            reloadListing();
          }
          return;
        }
        const code = resolveFilesystemErrorCode(error, "upload-chunk");
        if (code === "upload-cancelled") {
          if (fileBrowserStore.hasPendingListingReload) {
            reloadListing();
          }
          return;
        }
        const alwaysToast =
          code === "operation-busy" ||
          code === "no-source" ||
          code === "read-only-source" ||
          code === "upload-already-in-progress" ||
          code === "download-already-in-progress";
        if (alwaysToast || !fileBrowserStore.uploadModalOpen) {
          showLocalError(resolveErrorText(code));
        }
        if (fileBrowserStore.hasPendingListingReload) {
          reloadListing();
        }
        return;
      }

      dismissFileBrowserToast(messageApi);
      reloadListing();
    },
    [messageApi, reloadListing, resolveErrorText, showLocalError]
  );

  const browserLocked = fileBrowserStore.isBusy || fileEditorStore.isSaving;
  const activeUploadTarget = fileBrowserStore.activeUploadTargetDirectory;
  const canOpenUploadModal =
    !sourceReadOnly &&
    (activeUploadTarget == null || activeUploadTarget === fileBrowserStore.currentPath);
  const uploadButtonSoftLocked =
    canOpenUploadModal &&
    (fileBrowserStore.isLoading ||
      fileBrowserStore.sourcesLoading ||
      fileBrowserStore.isMutating ||
      fileBrowserStore.hasPendingListingReload ||
      fileEditorStore.isSaving);

  return (
    <div className={styles.page}>
      {messageContextHolder}
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
          <ErrorZone
            level="block"
            loaders={[fileBrowserStore.sourcesLoad, fileBrowserStore.directoryLoad]}
          >
            <FileBrowser
              currentPath={fileBrowserStore.currentPath}
              files={fileBrowserStore.files}
              isLoading={fileBrowserStore.isLoading}
              disabled={browserLocked}
              readOnly={sourceReadOnly}
              uploadDisabled={!canOpenUploadModal}
              uploadSoftLocked={uploadButtonSoftLocked}
              toasts={toasts}
              onNavigate={handleNavigate}
              onFileOpen={handleFileOpen}
              onDownload={handleDownload}
              isDownloadDisabled={(item) => fileBrowserStore.isTransferLockedPath(item.path)}
              onDelete={handleDelete}
              onRename={handleRename}
              onCreateFolder={handleCreateFolder}
              onCreateFile={handleCreateFile}
              onUploadClick={() => setUploadModalOpen(true)}
              onReload={handleReload}
            />
          </ErrorZone>
        </FileBrowserLayout>
      </div>

      <FileBrowserUploadModal
        open={uploadModalOpen}
        disabled={fileEditorStore.isSaving || sourceReadOnly}
        onClose={closeUploadModal}
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
