import { PageHeader } from "@saltbox/saltbox-frontend-common";
import { notification, Spin } from "antd";
import { observer } from "mobx-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileBrowser } from "saltbox-filesystem/components/file-browser/file-browser";
import { FileEditorModal } from "saltbox-filesystem/components/file-editor/file-editor-modal";
import { UploadModal } from "saltbox-filesystem/components/upload/upload-modal";
import { SourceSelector } from "saltbox-filesystem/components/source-selector/source-selector";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

import styles from "./browser.module.css";

export const FileBrowserPage = observer(() => {
  const { t } = useTranslation();
  const [notificationApi, contextHolder] = notification.useNotification();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);

  useEffect(() => {
    fileBrowserStore.loadSources().then(() => {
      fileBrowserStore.loadDirectory();
    });
  }, []);

  const handleNavigate = useCallback((path: string) => {
    fileBrowserStore.loadDirectory(undefined, path);
  }, []);

  const handleSourceChange = useCallback((source: string) => {
    fileBrowserStore.loadDirectory(source, "/");
  }, []);

  const handleFileOpen = useCallback((name: string) => {
    const fullPath = fileBrowserStore.currentPath === "/"
      ? `/${name}`
      : `${fileBrowserStore.currentPath}/${name}`;
    fileEditorStore.loadFile(fileBrowserStore.currentSource, fullPath);
    setEditorModalOpen(true);
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditorModalOpen(false);
    fileEditorStore.reset();
  }, []);

  const handleDownload = useCallback(async (name: string) => {
    const key = `download-${name}`;
    const controller = new AbortController();
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
    } catch (e: any) {
      if (e.name === "AbortError") {
        notificationApi.info({
          key,
          message: t("download.cancelled"),
          description: name,
          placement: "bottomRight",
        });
      } else {
        notificationApi.error({
          key,
          message: t("download.error"),
          description: name,
          placement: "bottomRight",
        });
      }
    }
  }, [t, notificationApi]);

  const handleRename = useCallback(async (oldName: string, newName: string) => {
    try {
      await fileBrowserStore.renameItem(oldName, newName);
    } catch (e: any) {
      console.error("Rename failed:", e);
    }
  }, []);

  const handleDelete = useCallback(async (name: string) => {
    try {
      await fileBrowserStore.deleteItem(name);
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, []);

  const handleCreateFolder = useCallback(async (name: string) => {
    try {
      await fileBrowserStore.createFolder(name);
    } catch (e: any) {
      console.error("Create folder failed:", e);
    }
  }, []);

  const handleCreateFile = useCallback(async (name: string) => {
    try {
      await fileBrowserStore.createFile(name);
    } catch (e: any) {
      console.error("Create file failed:", e);
    }
  }, []);

  const handleUpload = useCallback((file: File) => {
    return fileBrowserStore.uploadFile(file);
  }, []);

  return (
    <>
      {contextHolder}
      <PageHeader title={t("browser.title")} />

      <div className={styles.browserLayout}>
        <aside className={styles.sidebar}>
          <SourceSelector
            sources={fileBrowserStore.sources}
            currentSource={fileBrowserStore.currentSource}
            loading={fileBrowserStore.sourcesLoading}
            onSourceChange={handleSourceChange}
          />
        </aside>

        <main className={styles.content}>
          <FileBrowser
            currentPath={fileBrowserStore.currentPath}
            files={fileBrowserStore.files}
            isLoading={fileBrowserStore.isLoading}
            error={fileBrowserStore.error}
            onNavigate={handleNavigate}
            onFileOpen={handleFileOpen}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRename={handleRename}
            onCreateFolder={handleCreateFolder}
            onCreateFile={handleCreateFile}
            onUploadClick={() => setUploadModalOpen(true)}
          />
        </main>
      </div>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        uploads={fileBrowserStore.uploads}
        onCancelUpload={(id) => fileBrowserStore.cancelUpload(id)}
        onClearFinished={() => fileBrowserStore.clearFinishedUploads()}
      />

      <FileEditorModal
        open={editorModalOpen}
        onClose={handleEditorClose}
      />
    </>
  );
});
