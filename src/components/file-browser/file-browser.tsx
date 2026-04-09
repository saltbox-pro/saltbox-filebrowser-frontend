import { Button, Input, Modal } from "antd";
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
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
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
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setNewFolderModalOpen(false);
    }
  }, [newFolderName, onCreateFolder]);

  const handleCreateFile = useCallback(() => {
    if (newFileName.trim()) {
      onCreateFile(newFileName.trim());
      setNewFileName("");
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
      meta: { width: 137 } as CellMeta,
      enableSorting: false,
      cell: ({ row }) => (
        <FileActions
          name={row.original.name}
          isDirectory={row.original.isDirectory}
          onDownload={onDownload}
          onRename={handleRenameOpen}
          onDelete={onDelete}
        />
      ),
    }),
  ], [t, onDownload, handleRenameOpen, onDelete]);

  return (
    <div>
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
        columns={columns}
        data={files}
        isLoading={isLoading}
        isEmpty={!isLoading && files.length === 0}
        hideFooter
        sorting={sorting}
        onSortingChange={setSorting}
        getRowId={(row) => row.name}
        onRowClick={(record) => handleRowClick(record)}
        locale={{ empty: t("browser.empty") }}
      />

      <Modal
        title={t("actions.createFolder")}
        open={newFolderModalOpen}
        onOk={handleCreateFolder}
        onCancel={() => {
          setNewFolderModalOpen(false);
          setNewFolderName("");
        }}
        okText={t("actions.create")}
        cancelText={t("actions.cancel")}
      >
        <Input
          placeholder={t("actions.folderNamePlaceholder")}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>

      <Modal
        title={t("actions.createFile")}
        open={newFileModalOpen}
        onOk={handleCreateFile}
        onCancel={() => {
          setNewFileModalOpen(false);
          setNewFileName("");
        }}
        okText={t("actions.create")}
        cancelText={t("actions.cancel")}
      >
        <Input
          placeholder={t("actions.fileNamePlaceholder")}
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          onPressEnter={handleCreateFile}
          autoFocus
        />
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
