import { loader, type OnMount } from "@monaco-editor/react";
import { FileBrowserContentModal, slsEditorMonacoLoader } from "@saltbox/saltbox-frontend-common";
import { message } from "antd";
import { observer } from "mobx-react";
import * as monaco from "monaco-editor";
import { useCallback } from "react";
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

    const saltPath =
      fileEditorStore.filePath.length === 0
        ? ""
        : `salt://${fileEditorStore.filePath.replace(/\/+/g, "/").replace(/^\//, "")}`;

    const handleEditorMount: OnMount = useCallback(
      (editor, monacoApi) => {
        if (readOnly) {
          return;
        }
        editor.addCommand(monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS, () => {
          if (fileEditorStore.isDirty && !fileEditorStore.isSaving) {
            fileEditorStore.saveFile().then((saved) => {
              if (saved) {
                messageApi.success(t("editor.saveSuccess"));
              } else if (fileEditorStore.saveError) {
                messageApi.error(formatFilesystemError(t, tCommon, fileEditorStore.saveError));
              }
            });
          }
        });
      },
      [readOnly, t, tCommon, messageApi]
    );

    const handleChange = useCallback((value: string) => {
      fileEditorStore.updateContent(value);
    }, []);

    const handleSave = useCallback(async () => {
      const saved = await fileEditorStore.saveFile();
      if (saved) {
        messageApi.success(t("editor.saveSuccess"));
      } else if (fileEditorStore.saveError) {
        messageApi.error(formatFilesystemError(t, tCommon, fileEditorStore.saveError));
      }
    }, [t, tCommon, messageApi]);

    return (
      <>
        {contextHolder}
        <FileBrowserContentModal
          open={open}
          fileName={fileEditorStore.fileName}
          filePath={fileEditorStore.filePath}
          pathCopyText={saltPath}
          pathCopyTitle={t("actions.copySaltPath")}
          pathCopySuccessMessage={t("notifications.saltPathCopied", { path: saltPath })}
          pathCopyErrorMessage={t("notifications.saltPathCopyError")}
          language={fileEditorStore.language}
          content={fileEditorStore.currentContent}
          loading={fileEditorStore.isLoading}
          error={
            fileEditorStore.error
              ? formatFilesystemError(t, tCommon, fileEditorStore.error)
              : undefined
          }
          readOnly={readOnly}
          isDirty={fileEditorStore.isDirty}
          isSaving={fileEditorStore.isSaving}
          onChange={handleChange}
          onSave={handleSave}
          onClose={onClose}
          onEditorMount={handleEditorMount}
        />
      </>
    );
  }
);
