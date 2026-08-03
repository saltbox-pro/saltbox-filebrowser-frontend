import { loader } from "@monaco-editor/react";
import {
  FileBrowserContentModal,
  slsEditorMonacoLoader,
  type FileBrowserNotificationToasts,
} from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import * as monaco from "monaco-editor";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { resolveFilesystemErrorText } from "saltbox-filesystem/helpers/translate";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

loader.config({ monaco });
slsEditorMonacoLoader.config({ monaco });

interface FileEditorModalProps {
  open: boolean;
  readOnly?: boolean;
  onClose: () => void;
  toasts: FileBrowserNotificationToasts;
}

export const FileEditorModal = observer(
  ({ open, readOnly = false, onClose, toasts }: FileEditorModalProps) => {
    const { t } = useTranslation();
    const { showLocalError, showSuccessByKey, translateError, translateSuccess, actionLabels } =
      toasts;

    const filePath = fileEditorStore.filePath;
    const isEditing = fileEditorStore.mode === "edit";

    const saltPath =
      filePath.length === 0 ? "" : `salt://${filePath.replace(/\/+/g, "/").replace(/^\//, "")}`;

    const resolveErrorText = useCallback(
      (code: string) => resolveFilesystemErrorText(translateError, t, code),
      [t, translateError]
    );

    useEffect(() => {
      if (!open || readOnly) {
        fileEditorStore.cancelEdit();
      }
    }, [open, readOnly]);

    const handleChange = useCallback((value: string) => {
      fileEditorStore.updateContent(value);
    }, []);

    const handleSave = useCallback(async () => {
      const saved = await fileEditorStore.saveFile();
      if (saved) {
        showSuccessByKey({
          key: "file-save-success",
          params: { name: fileEditorStore.fileName },
          dismissStickyError: true,
        });
      } else if (fileEditorStore.saveError) {
        showLocalError(resolveErrorText(fileEditorStore.saveError));
      }
    }, [resolveErrorText, showLocalError, showSuccessByKey]);

    const canEdit =
      !readOnly &&
      !fileEditorStore.isLoading &&
      !fileEditorStore.isSaving &&
      fileEditorStore.error == null;

    return (
      <FileBrowserContentModal
        open={open}
        fileName={fileEditorStore.fileName}
        filePath={filePath}
        pathCopyText={saltPath}
        pathCopyTitle={actionLabels.copySaltPath}
        pathCopySuccessMessage={
          translateSuccess("salt-path-copied", { path: saltPath }) ?? saltPath
        }
        pathCopyErrorMessage={translateError("salt-path-copy-error")}
        language={fileEditorStore.language}
        content={isEditing ? fileEditorStore.currentContent : fileEditorStore.originalContent}
        loading={fileEditorStore.isLoading}
        empty={
          !isEditing && fileEditorStore.originalContent.length === 0 && !fileEditorStore.isLoading
        }
        error={fileEditorStore.error ? resolveErrorText(fileEditorStore.error) : undefined}
        readOnly={!isEditing}
        canEdit={canEdit}
        isDirty={fileEditorStore.isDirty}
        isSaving={fileEditorStore.isSaving}
        onEdit={readOnly ? undefined : () => fileEditorStore.enterEdit()}
        onCancelEdit={() => fileEditorStore.cancelEdit()}
        onChange={handleChange}
        onSave={handleSave}
        onClose={onClose}
      />
    );
  }
);
