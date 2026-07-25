import {
  FileBrowserLayout,
  FileBrowserSourceAside,
  PageHeader,
  isGlobalServerError,
  joinPathChild,
} from "@saltbox/saltbox-frontend-common";
import { message, notification, Spin } from "antd";
import { observer } from "mobx-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileBrowser } from "saltbox-filesystem/components/file-browser/file-browser";
import { FileEditorModal } from "saltbox-filesystem/components/file-editor/file-editor-modal";
import { UploadModal } from "saltbox-filesystem/components/upload/upload-modal";
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

  useEffect(() => {
    fileBrowserStore.loadSources().then((ok) => {
      if (ok) {
        return fileBrowserStore.loadDirectory();
      }
      return undefined;
    });
  }, []);

  const handleNavigate = useCallback((path: string) => {
    if (fileBrowserStore.isBusy) {
      return;
    }
    fileBrowserStore.loadDirectory(undefined, path);
  }, []);

  const handleSourceChange = useCallback((source: string) => {
    if (fileBrowserStore.isBusy) {
      return;
    }
    fileBrowserStore.loadDirectory(source, "/");
  }, []);

  const handleFileOpen = useCallback(
    (name: string) => {
      if (fileBrowserStore.isBusy) {
        return;
      }
      try {
        const fullPath = joinPathChild(fileBrowserStore.currentPath, name);
        fileEditorStore.loadFile(fileBrowserStore.currentSource, fullPath);
        setEditorModalOpen(true);
      } catch (e) {
        messageApi.error(e instanceof Error ? e.message : t("errors.fetchFileContent"));
      }
    },
    [messageApi, t]
  );

  const handleEditorClose = useCallback(() => {
    setEditorModalOpen(false);
    fileEditorStore.reset();
  }, []);

  const handleDownload = useCallback(
    async (name: string) => {
      const key = `download-${name}`;
      const controller = new AbortController();

      if (fileBrowserStore.isBusy) {
        messageApi.error(t("errors.operationBusy"));
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
          message: error instanceof Error ? error.message : t("download.error"),
          description: name,
          placement: "bottomRight",
        });
      }
    },
    [t, messageApi, notificationApi]
  );

  const handleRename = useCallback(
    async (oldName: string, newName: string, kind: "file" | "directory") => {
      const kindKey = kind === "directory" ? "directory" : "file";
      try {
        await fileBrowserStore.renameItem(oldName, newName);
        messageApi.success(
          tCommon(`file-browser.notifications.rename-${kindKey}-success`, {
            name: `${oldName} → ${newName}`,
          })
        );
      } catch (e) {
        if (!isGlobalServerError(e)) {
          messageApi.error(
            e instanceof Error
              ? e.message
              : tCommon(`file-browser.notifications.rename-${kindKey}-error`)
          );
        }
        throw e;
      }
    },
    [tCommon, messageApi]
  );

  const handleDelete = useCallback(
    async (name: string, kind: "file" | "directory") => {
      const kindKey = kind === "directory" ? "directory" : "file";
      try {
        await fileBrowserStore.deleteItem(name);
        messageApi.success(
          tCommon(`file-browser.notifications.delete-${kindKey}-success`, { name })
        );
      } catch (e) {
        if (!isGlobalServerError(e)) {
          messageApi.error(
            e instanceof Error
              ? e.message
              : tCommon(`file-browser.notifications.delete-${kindKey}-error`)
          );
        }
        throw e;
      }
    },
    [tCommon, messageApi]
  );

  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        await fileBrowserStore.createFolder(name);
        messageApi.success(
          tCommon("file-browser.notifications.create-directory-success", { name })
        );
      } catch (e) {
        if (!isGlobalServerError(e)) {
          messageApi.error(
            e instanceof Error
              ? e.message
              : tCommon("file-browser.notifications.create-directory-error")
          );
        }
        throw e;
      }
    },
    [tCommon, messageApi]
  );

  const handleCreateFile = useCallback(
    async (name: string) => {
      try {
        await fileBrowserStore.createFile(name);
        messageApi.success(tCommon("file-browser.notifications.create-file-success", { name }));
      } catch (e) {
        if (!isGlobalServerError(e)) {
          messageApi.error(
            e instanceof Error ? e.message : tCommon("file-browser.notifications.create-file-error")
          );
        }
        throw e;
      }
    },
    [tCommon, messageApi]
  );

  const handleUpload = useCallback((file: File) => {
    return fileBrowserStore.uploadFile(file);
  }, []);

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
              disabled={fileBrowserStore.isBusy}
              onChange={handleSourceChange}
            />
          }
        >
          <FileBrowser
            currentPath={fileBrowserStore.currentPath}
            files={fileBrowserStore.files}
            isLoading={fileBrowserStore.isLoading}
            disabled={fileBrowserStore.isBusy}
            error={fileBrowserStore.error}
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
