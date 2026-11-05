import {
  FileBrowserActionsPanel,
  FileBrowserView,
  MatIcon,
  isTextFile,
  type FileBrowserBulkDeleteResult,
  type FileBrowserItem,
  type FileBrowserNotificationToasts,
  type FileBrowserViewProps,
} from "@saltbox/saltbox-frontend-common";
import { Button } from "antd";
import { useCallback, useMemo } from "react";

import { SALT_PATH_PREFIX } from "saltbox-filesystem/constants/salt-path";
import type { SelectedPaths } from "saltbox-filesystem/shared/types";
import type { FileEntry } from "saltbox-filesystem/store/file-browser-store";

import { toFileBrowserItem } from "./map-to-file-browser-item";

type RowSelectionChangeHandler = NonNullable<FileBrowserViewProps["onRowSelectionChange"]>;

interface FileBrowserProps {
  currentPath: string;
  files: FileEntry[];
  selectedPaths: SelectedPaths;
  isLoading: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  uploadDisabled?: boolean;
  uploadSoftLocked?: boolean;
  toasts: FileBrowserNotificationToasts;
  onNavigate: (path: string) => void;
  onFileOpen: (name: string) => void;
  onDownload: (name: string) => void;
  isDownloadDisabled?: (item: FileBrowserItem) => boolean;
  canDelete?: (item: FileBrowserItem) => boolean;
  canRename?: (item: FileBrowserItem) => boolean;
  onDelete: (name: string, kind: FileBrowserItem["kind"]) => void;
  onSelectionChange: (selectedPaths: SelectedPaths) => void;
  onDeleteSelected: (items: FileBrowserItem[]) => Promise<FileBrowserBulkDeleteResult>;
  onRename: (oldName: string, newName: string, kind: FileBrowserItem["kind"]) => void;
  onCreateFolder: (name: string) => void;
  onCreateFile: (name: string) => void;
  onUploadClick: () => void;
  onReload: () => void | Promise<void>;
}

export function FileBrowser({
  currentPath,
  files,
  selectedPaths,
  isLoading,
  disabled = false,
  readOnly = false,
  uploadDisabled = false,
  uploadSoftLocked = false,
  toasts,
  onNavigate,
  onFileOpen,
  onDownload,
  isDownloadDisabled,
  canDelete,
  canRename,
  onDelete,
  onSelectionChange,
  onDeleteSelected,
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

  const selectedItems = useMemo(
    () => items.filter((item) => selectedPaths[item.id] === true),
    [items, selectedPaths]
  );

  const handleRowSelectionChange = useCallback<RowSelectionChangeHandler>(
    (updater) => {
      onSelectionChange(typeof updater === "function" ? updater(selectedPaths) : updater);
    },
    [onSelectionChange, selectedPaths]
  );
  return (
    <FileBrowserActionsPanel
      disabled={interactionLocked}
      downloadDisabled={interactionLocked}
      onDownload={(item) => onDownload(item.name)}
      isDownloadDisabled={isDownloadDisabled}
      canRename={readOnly ? undefined : canRename}
      canDelete={readOnly ? undefined : canDelete}
      onRename={readOnly ? undefined : (item, newName) => onRename(item.name, newName, item.kind)}
      onDelete={readOnly ? undefined : (item) => onDelete(item.name, item.kind)}
      selectedItems={readOnly ? undefined : selectedItems}
      onDeleteSelected={readOnly ? undefined : onDeleteSelected}
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
    >
      {({ toolbar, selectionToolbar, rowActions }) => (
        <FileBrowserView
          tableId="filebrowser-files"
          currentPath={currentPath}
          items={items}
          isLoading={isLoading}
          navigationDisabled={interactionLocked}
          pathCopyPrefix={SALT_PATH_PREFIX}
          pathCopyTitle={actionLabels.copySaltPath}
          showSuccessByKey={showSuccessByKey}
          showErrorByCode={showErrorByCode}
          toolbar={toolbar}
          selectionToolbar={selectionToolbar}
          rowActions={rowActions}
          rowSelection={readOnly ? undefined : selectedPaths}
          onRowSelectionChange={readOnly ? undefined : handleRowSelectionChange}
          onNavigate={onNavigate}
          onItemClick={handleItemClick}
          isItemClickable={(item) =>
            item.kind === "directory" || isTextFile(item.name, item.iconHint)
          }
        />
      )}
    </FileBrowserActionsPanel>
  );
}
