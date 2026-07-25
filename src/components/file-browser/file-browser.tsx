import {
  FileBrowserActionsPanel,
  FileBrowserView,
  type FileBrowserItem,
  MatIcon,
} from "@saltbox/saltbox-frontend-common";
import { Button } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { isTextFile } from "saltbox-filesystem/shared/language-utils";
import type { FileEntry } from "saltbox-filesystem/store/file-browser-store";

import { toFileBrowserItem } from "./map-to-file-browser-item";
import { SaltPathCopyButton } from "./salt-path-copy-button";

interface FileBrowserProps {
  currentPath: string;
  files: FileEntry[];
  isLoading: boolean;
  disabled?: boolean;
  error?: string;
  messageApi: MessageInstance;
  onNavigate: (path: string) => void;
  onFileOpen: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string, kind: FileBrowserItem["kind"]) => void;
  onRename: (oldName: string, newName: string, kind: FileBrowserItem["kind"]) => void;
  onCreateFolder: (name: string) => void;
  onCreateFile: (name: string) => void;
  onUploadClick: () => void;
}

export function FileBrowser({
  currentPath,
  files,
  isLoading,
  disabled = false,
  error,
  messageApi,
  onNavigate,
  onFileOpen,
  onDownload,
  onDelete,
  onRename,
  onCreateFolder,
  onCreateFile,
  onUploadClick,
}: FileBrowserProps) {
  const { t } = useTranslation();

  const items = useMemo(
    () =>
      files
        .map((entry) => toFileBrowserItem(entry, currentPath))
        .filter((item): item is FileBrowserItem => item != null),
    [currentPath, files]
  );

  const handleItemClick = useCallback(
    (item: FileBrowserItem) => {
      if (item.kind === "directory") {
        onNavigate(item.path);
        return;
      }

      if (isTextFile(item.name, item.iconHint)) {
        onFileOpen(item.name);
      }
    },
    [onFileOpen, onNavigate]
  );

  const interactionLocked = disabled || isLoading;

  return (
    <FileBrowserActionsPanel
      disabled={interactionLocked}
      onDownload={(item) => onDownload(item.name)}
      onRename={(item, newName) => onRename(item.name, newName, item.kind)}
      onDelete={(item) => onDelete(item.name, item.kind)}
      onCreateFolder={onCreateFolder}
      onCreateFile={onCreateFile}
      toolbarLeading={
        <Button
          type="primary"
          icon={<MatIcon icon="upload_file" size="small" />}
          aria-disabled={interactionLocked || undefined}
          tabIndex={interactionLocked ? -1 : undefined}
          onClick={() => {
            if (interactionLocked) {
              return;
            }
            onUploadClick();
          }}
        >
          {t("actions.upload")}
        </Button>
      }
      renderLeadingActions={(item) => (
        <SaltPathCopyButton currentPath={currentPath} name={item.name} messageApi={messageApi} />
      )}
    >
      {({ toolbar, renderRowActions }) => (
        <FileBrowserView
          tableId="filebrowser-files"
          currentPath={currentPath}
          items={items}
          isLoading={isLoading}
          navigationDisabled={interactionLocked}
          error={error}
          showActionsColumn
          toolbar={toolbar}
          onNavigate={onNavigate}
          onItemClick={handleItemClick}
          renderRowActions={renderRowActions}
        />
      )}
    </FileBrowserActionsPanel>
  );
}
