import { CopyOutlined, LockOutlined } from "@ant-design/icons";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import { slsEditorMonacoLoader } from "@saltbox/saltbox-frontend-common";
import { Button, Modal, Spin, Tag, message } from "antd";
import { observer } from "mobx-react";
import * as monaco from "monaco-editor";
import type { editor } from "monaco-editor";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { formatFilesystemError } from "saltbox-filesystem/helpers/translate";
import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";

import styles from "./file-editor-modal.module.css";

loader.config({ monaco });
slsEditorMonacoLoader.config({ monaco });

type EditorOptions = editor.IStandaloneEditorConstructionOptions;

const EDITOR_OPTIONS: EditorOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "on",
  lineNumbers: "on",
  tabSize: 2,
  insertSpaces: true,
  automaticLayout: true,
};

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
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    const handleEditorMount: OnMount = useCallback(
      (editor, monaco) => {
        editorRef.current = editor;
        if (readOnly) {
          return;
        }
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
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

    const handleChange = useCallback((value: string | undefined) => {
      fileEditorStore.updateContent(value ?? "");
    }, []);

    const handleSave = useCallback(async () => {
      const saved = await fileEditorStore.saveFile();
      if (saved) {
        messageApi.success(t("editor.saveSuccess"));
      } else if (fileEditorStore.saveError) {
        messageApi.error(formatFilesystemError(t, tCommon, fileEditorStore.saveError));
      }
    }, [t, tCommon, messageApi]);

    const handleClose = useCallback(() => {
      if (fileEditorStore.isSaving) {
        return;
      }
      if (fileEditorStore.isDirty) {
        Modal.confirm({
          title: t("editor.unsavedWarning"),
          onOk: () => {
            onClose();
          },
        });
      } else {
        onClose();
      }
    }, [onClose, t]);

    const handleCopySaltPath = useCallback(() => {
      const saltPath = `salt://${fileEditorStore.filePath.replace(/\/+/g, "/").replace(/^\//, "")}`;
      navigator.clipboard.writeText(saltPath).then(
        () => {
          messageApi.success(t("notifications.saltPathCopied", { path: saltPath }));
        },
        () => {
          messageApi.error(t("notifications.saltPathCopyError"));
        }
      );
    }, [t, messageApi]);

    const title = (
      <div className={styles.headerInfo}>
        <span>{fileEditorStore.fileName}</span>
        <Tag>{fileEditorStore.language}</Tag>
        {readOnly && <Tag icon={<LockOutlined />}>{t("editor.readOnly")}</Tag>}
        <Button
          type="text"
          size="small"
          icon={<CopyOutlined />}
          onClick={handleCopySaltPath}
          title={t("actions.copySaltPath")}
        />
        {fileEditorStore.isDirty && (
          <span className={styles.dirtyIndicator} title={t("editor.unsavedChanges")} />
        )}
      </div>
    );

    const footer = (
      <>
        <Button onClick={handleClose} disabled={fileEditorStore.isSaving}>
          {tCommon("file-browser.actions.cancel")}
        </Button>
        {!readOnly && (
          <Button
            type="primary"
            onClick={handleSave}
            disabled={!fileEditorStore.isDirty || fileEditorStore.isSaving}
            loading={fileEditorStore.isSaving}
          >
            {t("editor.save")}
          </Button>
        )}
      </>
    );

    return (
      <>
        {contextHolder}
        <Modal
          open={open}
          title={title}
          footer={footer}
          onCancel={handleClose}
          width="95vw"
          centered
          styles={{ body: { height: "85vh", padding: 0, overflow: "hidden" } }}
          destroyOnHidden
          maskClosable={!fileEditorStore.isSaving}
          closable={!fileEditorStore.isSaving}
          keyboard={!fileEditorStore.isSaving}
        >
          {fileEditorStore.isLoading ? (
            <div className={styles.loadingContainer}>
              <Spin size="large" />
            </div>
          ) : fileEditorStore.error ? (
            <div className={styles.errorContainer}>
              {formatFilesystemError(t, tCommon, fileEditorStore.error)}
            </div>
          ) : (
            <div
              className={`${styles.editorContainer}${readOnly ? ` ${styles.editorContainer_readOnly}` : ""}`}
            >
              <Editor
                height="100%"
                language={fileEditorStore.language}
                value={fileEditorStore.currentContent}
                onChange={handleChange}
                onMount={handleEditorMount}
                options={{
                  ...EDITOR_OPTIONS,
                  readOnly: readOnly || fileEditorStore.isSaving,
                }}
              />
            </div>
          )}
        </Modal>
      </>
    );
  }
);
