import {
  FileBrowserActionsPanel,
  FileBrowserCopyPathButton,
  FileBrowserView,
  MatIcon,
  isTextFile,
  type FileBrowserItem,
  type FileBrowserNotificationToasts,
} from "@saltbox/saltbox-frontend-common";
import { Button } from "antd";
import { useCallback, useMemo } from "react";

import { SALT_PATH_PREFIX } from "saltbox-filesystem/constants/salt-path";
import type { FileEntry } from "saltbox-filesystem/store/file-browser-store";

import { toFileBrowserItem } from "./map-to-file-browser-item";

interface FileBrowserProps {
  currentPath: string;
  files: FileEntry[];
  isLoading: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  uploadDisabled?: boolean;
  uploadSoftLocked?: boolean;
  error?: string;
  toasts: FileBrowserNotificationToasts;
  onNavigate: (path: string) => void;
  onFileOpen: (name: string) => void;
  onDownload: (name: string) => void;
  onDelete: (name: string, kind: FileBrowserItem["kind"]) => void;
  onRename: (oldName: string, newName: string, kind: FileBrowserItem["kind"]) => void;
  onCreateFolder: (name: string) => void;
  onCreateFile: (name: string) => void;
  onUploadClick: () => void;
  onReload: () => void | Promise<void>;
}

export function FileBrowser({
  currentPath,
  files,
  isLoading,
  disabled = false,
  readOnly = false,
  uploadDisabled = false,
  uploadSoftLocked = false,
  error,
  toasts,
  onNavigate,
  onFileOpen,
  onDownload,
  onDelete,
  onRename,
  onCreateFolder,
  onCreateFile,
  onUploadClick,
  onReload,
}: FileBrowserProps) {
  const { actionLabels, showLocalError, showSuccessByKey, showErrorByCode } = toasts;

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
      onRename={readOnly ? undefined : (item, newName) => onRename(item.name, newName, item.kind)}
      onDelete={readOnly ? undefined : (item) => onDelete(item.name, item.kind)}
      onCreateFolder={readOnly ? undefined : onCreateFolder}
      onCreateFile={readOnly ? undefined : onCreateFile}
      onReload={onReload}
      onSubmitError={showLocalError}
      toolbarTrailing={
        readOnly ? undefined : (
          <Button
            type="primary"
            icon={<MatIcon icon="upload_file" size="small" />}
            disabled={uploadDisabled}
            aria-disabled={uploadSoftLocked || undefined}
            tabIndex={uploadSoftLocked ? -1 : undefined}
            onClick={() => {
              if (uploadSoftLocked || uploadDisabled) {
                return;
              }
              onUploadClick();
            }}
          >
            {actionLabels.upload}
          </Button>
        )
      }
      renderLeadingActions={(item) => (
        <FileBrowserCopyPathButton
          path={item.path}
          pathCopyPrefix={SALT_PATH_PREFIX}
          title={actionLabels.copySaltPath}
          appearance="row"
          showSuccessByKey={showSuccessByKey}
          showErrorByCode={showErrorByCode}
        />
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
          pathCopyPrefix={SALT_PATH_PREFIX}
          pathCopyTitle={actionLabels.copySaltPath}
          showSuccessByKey={showSuccessByKey}
          showErrorByCode={showErrorByCode}
          toolbar={toolbar}
          onNavigate={onNavigate}
          onItemClick={handleItemClick}
          isItemClickable={(item) =>
            item.kind === "directory" || isTextFile(item.name, item.iconHint)
          }
          renderRowActions={renderRowActions}
        />
      )}
    </FileBrowserActionsPanel>
  );
}
