import { Table, Button, Input, Modal, Empty } from "antd";
import { MatIcon } from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { FileEntry } from "saltbox-filesystem/store/file-browser-store";
import { formatFileSize, getFileIcon, getParentPath } from "saltbox-filesystem/shared/utils";
import { isTextFile } from "saltbox-filesystem/shared/language-utils";
import { BreadcrumbNav } from "./breadcrumb-nav";
import { FileActions } from "./file-actions";
import styles from "./file-browser.module.css";

interface FileBrowserProps {
  currentPath: string;
  files: FileEntry[];
  isLoading: boolean;
  error?: string;
  onNavigate: (path: string) => void;
  onFileOpen: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
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
  onCreateFolder,
  onCreateFile,
  onUploadClick,
}: FileBrowserProps) => {
  const { t } = useTranslation();
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");

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

  const isRoot = currentPath === "/";

  const columns = [
    {
      title: t("browser.name"),
      dataIndex: "name",
      key: "name",
      sorter: (a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name),
      render: (name: string, record: FileEntry) => (
        <span className={styles.fileName}>
          <span className={record.isDirectory ? styles.folderIcon : styles.fileIcon}>
            <MatIcon icon={getFileIcon(record.type)} />
          </span>
          {name}
        </span>
      ),
    },
    {
      title: t("browser.size"),
      dataIndex: "size",
      key: "size",
      width: 120,
      sorter: (a: FileEntry, b: FileEntry) => a.size - b.size,
      render: (size: number, record: FileEntry) =>
        record.isDirectory ? "—" : formatFileSize(size),
    },
    {
      title: t("browser.modified"),
      dataIndex: "modified",
      key: "modified",
      width: 200,
      sorter: (a: FileEntry, b: FileEntry) =>
        new Date(a.modified).getTime() - new Date(b.modified).getTime(),
      render: (modified: string) =>
        modified ? new Date(modified).toLocaleString() : "—",
    },
    {
      title: t("browser.actions"),
      key: "actions",
      width: 100,
      render: (_: any, record: FileEntry) => (
        <FileActions
          name={record.name}
          isDirectory={record.isDirectory}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ),
    },
  ];

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

      <Table
        dataSource={files}
        columns={columns}
        loading={isLoading}
        rowKey="name"
        pagination={false}
        size="small"
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          className: (record.isDirectory || isTextFile(record.name, record.type)) ? styles.fileRow : undefined,
          style: (record.isDirectory || isTextFile(record.name, record.type)) ? { cursor: "pointer" } : undefined,
        })}
        locale={{
          emptyText: (
            <Empty description={t("browser.empty")} />
          ),
        }}
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
    </div>
  );
});
