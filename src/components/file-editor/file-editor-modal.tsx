import { loader } from "@monaco-editor/react";
import { FileBrowserContentModal, slsEditorMonacoLoader } from "@saltbox/saltbox-frontend-common";
import { message } from "antd";
import { observer } from "mobx-react";
import * as monaco from "monaco-editor";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { formatFilesystemError } from "saltbox-filesystem/helpers/translate";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

loader.config({ monaco });
slsEditorMonacoLoader.config({ monaco });

interface FileEditorModalProps {
  open: boolean;
  readOnly?: boolean;
  onClose: () => void;
}

export const FileEditorModal = observer(
  ({ open, readOnly = false, onClose }: FileEditorModalProps) => {
    const { t } = useTranslation();
    const { t: tCommon } = useTranslation("common");
    const [messageApi, contextHolder] = message.useMessage();

    const filePath = fileEditorStore.filePath;
    const isEditing = fileEditorStore.mode === "edit";

    const saltPath =
      filePath.length === 0 ? "" : `salt://${filePath.replace(/\/+/g, "/").replace(/^\//, "")}`;

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
        messageApi.success(
          tCommon("file-browser.notifications.file-save-success", {
            name: fileEditorStore.fileName,
          })
        );
      } else if (fileEditorStore.saveError) {
        messageApi.error(formatFilesystemError(t, tCommon, fileEditorStore.saveError));
      }
    }, [t, tCommon, messageApi]);

    const canEdit =
      !readOnly &&
      !fileEditorStore.isLoading &&
      !fileEditorStore.isSaving &&
      fileEditorStore.error == null;

    return (
      <>
        {contextHolder}
        <FileBrowserContentModal
          open={open}
          fileName={fileEditorStore.fileName}
          filePath={filePath}
          pathCopyText={saltPath}
          pathCopyTitle={t("actions.copySaltPath")}
          pathCopySuccessMessage={t("notifications.saltPathCopied", { path: saltPath })}
          pathCopyErrorMessage={t("notifications.saltPathCopyError")}
          language={fileEditorStore.language}
          content={isEditing ? fileEditorStore.currentContent : fileEditorStore.originalContent}
          loading={fileEditorStore.isLoading}
          empty={
            !isEditing && fileEditorStore.originalContent.length === 0 && !fileEditorStore.isLoading
          }
          error={
            fileEditorStore.error
              ? formatFilesystemError(t, tCommon, fileEditorStore.error)
              : undefined
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
      </>
    );
  }
);
