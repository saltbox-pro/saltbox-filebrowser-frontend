import { Button, Input, Modal, Spin } from "antd";
import { FastTableListed, MatIcon, type CellMeta } from "@saltbox/saltbox-frontend-common";
import { createColumnHelper, type SortingState } from "@tanstack/react-table";
import { observer } from "mobx-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileEntry } from "saltbox-filesystem/store/file-browser-store";
import { formatFileSize, getFileIcon, getParentPath } from "saltbox-filesystem/shared/utils";
import { isTextFile } from "saltbox-filesystem/shared/language-utils";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { FileActions } from "./file-actions";
import styles from "./file-browser.module.css";

const columnHelper = createColumnHelper<FileEntry>();

interface FileBrowserProps {
  currentPath: string;
  files: FileEntry[];
  isLoading: boolean;
  error?: string;
  onNavigate: (path: string) => void;
  onFileOpen: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onCreateFolder: (name: string) => void;
  onCreateFile: (name: string) => void;
  onUploadClick: () => void;
}

export const FileBrowser = observer(({
  currentPath,
  files,
  isLoading,
  error,
  onNavigate,
  onFileOpen,
  onDownload,
  onDelete,
  onRename,
  onCreateFolder,
  onCreateFile,
  onUploadClick,
}: FileBrowserProps) => {
  const { t } = useTranslation();
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderTouched, setNewFolderTouched] = useState(false);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileTouched, setNewFileTouched] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameOldName, setRenameOldName] = useState("");
  const [renameNewName, setRenameNewName] = useState("");

  const handleRowClick = useCallback(
    (record: FileEntry) => {
      if (record.isDirectory) {
        const newPath = currentPath === "/"
          ? `/${record.name}`
          : `${currentPath}/${record.name}`;
        onNavigate(newPath);
      } else if (isTextFile(record.name, record.type)) {
        onFileOpen(record.name);
      }
    },
    [currentPath, onNavigate, onFileOpen],
  );

  const handleCreateFolder = useCallback(() => {
    setNewFolderTouched(true);
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setNewFolderTouched(false);
      setNewFolderModalOpen(false);
    }
  }, [newFolderName, onCreateFolder]);

  const handleCreateFile = useCallback(() => {
    setNewFileTouched(true);
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName("");
      setNewFileTouched(false);
      setNewFileModalOpen(false);
    }
  }, [newFileName, onCreateFile]);

  const handleRenameOpen = useCallback((name: string) => {
    setRenameOldName(name);
    setRenameNewName(name);
    setRenameModalOpen(true);
  }, []);

  const handleRenameConfirm = useCallback(() => {
    const trimmed = renameNewName.trim();
    if (trimmed && trimmed !== renameOldName) {
      onRename(renameOldName, trimmed);
    }
    setRenameModalOpen(false);
    setRenameOldName("");
    setRenameNewName("");
  }, [renameOldName, renameNewName, onRename]);

  const isRoot = currentPath === "/";
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo(() => [
    columnHelper.accessor("name", {
      header: t("browser.name"),
      cell: ({ row }) => (
        <span className={styles.fileName}>
          <span className={row.original.isDirectory ? styles.folderIcon : styles.fileIcon}>
            <MatIcon icon={getFileIcon(row.original.type)} />
          </span>
          {row.original.name}
        </span>
      ),
    }),
    columnHelper.accessor("size", {
      header: t("browser.size"),
      meta: { width: 120 } as CellMeta,
      cell: ({ row }) =>
        row.original.isDirectory ? "—" : formatFileSize(row.original.size),
    }),
    columnHelper.accessor("modified", {
      header: t("browser.modified"),
      meta: { width: 200 } as CellMeta,
      cell: ({ getValue }) => {
        const modified = getValue();
        return modified ? new Date(modified).toLocaleString() : "—";
      },
    }),
    columnHelper.display({
      id: "actions",
      header: t("browser.actions"),
      meta: { width: 170 } as CellMeta,
      enableSorting: false,
      cell: ({ row }) => (
        <FileActions
          name={row.original.name}
          currentPath={currentPath}
          isDirectory={row.original.isDirectory}
          onDownload={onDownload}
          onRename={handleRenameOpen}
          onDelete={onDelete}
        />
      ),
    }),
  ], [t, currentPath, onDownload, handleRenameOpen, onDelete]);

  return (
    <div>
      <Spin spinning={isLoading}>
        <div className={styles.navBar}>
          <div className={styles.navLeft}>
            <Button
              type="text"
              size="small"
              icon={<MatIcon icon="arrow_upward" size="small" />}
              disabled={isRoot}
              onClick={() => onNavigate(getParentPath(currentPath))}
            />
            <BreadcrumbNav currentPath={currentPath} onNavigate={onNavigate} />
          </div>
          <div className={styles.navRight}>
            <Button
              type="primary"
              icon={<MatIcon icon="upload_file" size="small" />}
              onClick={onUploadClick}
            >
              {t("actions.upload")}
            </Button>
            <Button
              icon={<MatIcon icon="create_new_folder" size="small" />}
              onClick={() => setNewFolderModalOpen(true)}
            >
              {t("actions.createFolder")}
            </Button>
            <Button
              icon={<MatIcon icon="note_add" size="small" />}
              onClick={() => setNewFileModalOpen(true)}
            >
              {t("actions.createFile")}
            </Button>
          </div>
        </div>

        {error && <div style={{ color: "red", marginBottom: 16 }}>{error}</div>}

        <FastTableListed
          tableId="filebrowser-files"
          enableColumnResize={false}
          columns={columns}
          data={files}
          isEmpty={!isLoading && files.length === 0}
          hideFooter
          sorting={sorting}
          onSortingChange={setSorting}
          getRowId={(row) => row.name}
          onRowClick={(record) => handleRowClick(record)}
          locale={{ empty: t("browser.empty") }}
        />
      </Spin>

      <Modal
        title={t("actions.createFolder")}
        open={newFolderModalOpen}
        onOk={handleCreateFolder}
        onCancel={() => {
          setNewFolderModalOpen(false);
          setNewFolderName("");
          setNewFolderTouched(false);
        }}
        okText={t("actions.create")}
        cancelText={t("actions.cancel")}
        okButtonProps={{ disabled: !newFolderName.trim() }}
      >
        <Input
          placeholder={t("actions.folderNamePlaceholder")}
          value={newFolderName}
          status={newFolderTouched && !newFolderName.trim() ? "error" : undefined}
          onChange={(e) => {
            setNewFolderName(e.target.value);
            setNewFolderTouched(true);
          }}
          onBlur={() => setNewFolderTouched(true)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
        {newFolderTouched && !newFolderName.trim() && (
          <div style={{ color: "#ff4d4f", fontSize: 12, marginTop: 4 }}>
            {t("actions.nameRequired")}
          </div>
        )}
      </Modal>

      <Modal
        title={t("actions.createFile")}
        open={newFileModalOpen}
        onOk={handleCreateFile}
        onCancel={() => {
          setNewFileModalOpen(false);
          setNewFileName("");
          setNewFileTouched(false);
        }}
        okText={t("actions.create")}
        cancelText={t("actions.cancel")}
        okButtonProps={{ disabled: !newFileName.trim() }}
      >
        <Input
          placeholder={t("actions.fileNamePlaceholder")}
          value={newFileName}
          status={newFileTouched && !newFileName.trim() ? "error" : undefined}
          onChange={(e) => {
            setNewFileName(e.target.value);
            setNewFileTouched(true);
          }}
          onBlur={() => setNewFileTouched(true)}
          onPressEnter={handleCreateFile}
          autoFocus
        />
        {newFileTouched && !newFileName.trim() && (
          <div style={{ color: "#ff4d4f", fontSize: 12, marginTop: 4 }}>
            {t("actions.nameRequired")}
          </div>
        )}
      </Modal>

      <Modal
        title={t("actions.rename")}
        open={renameModalOpen}
        onOk={handleRenameConfirm}
        onCancel={() => {
          setRenameModalOpen(false);
          setRenameOldName("");
          setRenameNewName("");
        }}
        okText={t("actions.rename")}
        cancelText={t("actions.cancel")}
        okButtonProps={{ disabled: !renameNewName.trim() || renameNewName.trim() === renameOldName }}
      >
        <Input
          placeholder={t("actions.newNamePlaceholder")}
          value={renameNewName}
          onChange={(e) => setRenameNewName(e.target.value)}
          onPressEnter={handleRenameConfirm}
          autoFocus
        />
      </Modal>
    </div>
  );
});
