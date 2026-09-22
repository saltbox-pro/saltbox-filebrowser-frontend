import { loader } from "@monaco-editor/react";
import {
  FileBrowserContentModal,
  MutationErrorAlert,
  runMutation,
  slsEditorMonacoLoader,
  type FileBrowserNotificationToasts,
} from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import * as monaco from "monaco-editor";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { SALT_PATH_PREFIX } from "saltbox-filesystem/constants/salt-path";
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
    const { t: tCommon } = useTranslation("common");
    const { showSuccessByKey, showErrorByCode, actionLabels } = toasts;

    const filePath = fileEditorStore.filePath;
    const isEditing = fileEditorStore.mode === "edit";
    const saveError = fileEditorStore.saveError;

    useEffect(() => {
      if (!open || readOnly) {
        fileEditorStore.cancelEdit();
      }
    }, [open, readOnly]);

    const handleChange = useCallback((value: string) => {
      fileEditorStore.updateContent(value);
    }, []);

    const handleSave = useCallback(async () => {
      if (
        fileEditorStore.mode !== "edit" ||
        fileEditorStore.hasLoadError ||
        fileEditorStore.isLoading ||
        fileEditorStore.isSaving
      ) {
        return;
      }
      const fileName = fileEditorStore.fileName;
      const result = await runMutation({
        run: async () => {
          const saved = await fileEditorStore.saveFile();
          if (!saved) {
            throw new DOMException("Aborted", "AbortError");
          }
        },
        successMessage: tCommon("file-browser.notifications.file-save-success", { name: fileName }),
        onError: (error) => {
          fileEditorStore.setSaveError(error);
        },
      });
      if (result.ok) {
        fileEditorStore.clearSaveError();
      }
    }, [tCommon]);

    const canEdit =
      !readOnly &&
      !fileEditorStore.isLoading &&
      !fileEditorStore.isSaving &&
      !fileEditorStore.hasLoadError;

    return (
      <FileBrowserContentModal
        open={open}
        fileName={fileEditorStore.fileName}
        filePath={filePath}
        pathCopyPrefix={SALT_PATH_PREFIX}
        pathCopyTitle={actionLabels.copySaltPath}
        showSuccessByKey={showSuccessByKey}
        showErrorByCode={showErrorByCode}
        language={fileEditorStore.language}
        content={isEditing ? fileEditorStore.currentContent : fileEditorStore.originalContent}
        loading={fileEditorStore.isLoading}
        empty={
          !isEditing &&
          fileEditorStore.originalContent.length === 0 &&
          !fileEditorStore.isLoading &&
          !fileEditorStore.hasLoadError
        }
        loaders={[fileEditorStore.fileLoad]}
        editorError={
          saveError != null ? (
            <MutationErrorAlert
              error={saveError}
              fallback={t("errors.saveFileFailed")}
              onClose={() => fileEditorStore.clearSaveError()}
            />
          ) : undefined
        }
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
