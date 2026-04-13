import { Button, Modal, Spin, Tag, message } from "antd";
import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { editor } from "monaco-editor";
import { observer } from "mobx-react";
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { fileEditorStore } from "saltbox-filesystem/store/file-editor-store";
import styles from "./file-editor-modal.module.css";
import {slsEditorMonacoLoader} from "@saltbox/saltbox-frontend-common";


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
  onClose: () => void;
}

export const FileEditorModal = observer(({ open, onClose }: FileEditorModalProps) => {
  const { t } = useTranslation();
  const [messageApi, contextHolder] = message.useMessage();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (fileEditorStore.isDirty && !fileEditorStore.isSaving) {
        fileEditorStore.saveFile().then(() => {
          if (!fileEditorStore.saveError) {
            messageApi.success(t("editor.saveSuccess"));
          } else {
            messageApi.error(t("editor.saveError"));
          }
        });
      }
    });
  }, [t, messageApi]);

  const handleChange = useCallback((value: string | undefined) => {
    fileEditorStore.updateContent(value ?? "");
  }, []);

  const handleSave = useCallback(async () => {
    await fileEditorStore.saveFile();
    if (!fileEditorStore.saveError) {
      messageApi.success(t("editor.saveSuccess"));
    } else {
      messageApi.error(t("editor.saveError"));
    }
  }, [t, messageApi]);

  const handleClose = useCallback(() => {
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

  const title = (
    <div className={styles.headerInfo}>
      <span>{fileEditorStore.fileName}</span>
      <Tag>{fileEditorStore.language}</Tag>
      {fileEditorStore.isDirty && <span className={styles.dirtyIndicator} title={t("editor.unsavedChanges")} />}
    </div>
  );

  const footer = (
    <>
      <Button onClick={handleClose}>
        {t("actions.cancel")}
      </Button>
      <Button
        type="primary"
        onClick={handleSave}
        disabled={!fileEditorStore.isDirty}
        loading={fileEditorStore.isSaving}
      >
        {t("editor.save")}
      </Button>
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
    >
      {fileEditorStore.isLoading ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
        </div>
      ) : fileEditorStore.error ? (
        <div className={styles.errorContainer}>
          {t("editor.loadError")}: {fileEditorStore.error}
        </div>
      ) : (
        <div className={styles.editorContainer}>
          <Editor
            height="100%"
            language={fileEditorStore.language}
            value={fileEditorStore.currentContent}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={EDITOR_OPTIONS}
          />
        </div>
      )}
    </Modal>
    </>
  );
});
