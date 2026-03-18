import { PageHeader } from "@saltbox/saltbox-frontend-common";
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

  const handleDownload = useCallback((name: string) => {
    fileBrowserStore.downloadItem(name);
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

  const handleUpload = useCallback(async (file: File) => {
    await fileBrowserStore.uploadFile(file);
  }, []);

  return (
    <>
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
            onCreateFolder={handleCreateFolder}
            onUploadClick={() => setUploadModalOpen(true)}
          />
        </main>
      </div>

      <UploadModal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
      />

      <FileEditorModal
        open={editorModalOpen}
        onClose={handleEditorClose}
      />
    </>
  );
});
