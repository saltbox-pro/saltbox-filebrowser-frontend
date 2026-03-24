import { Button, Modal, Progress, Upload } from "antd";
import { MatIcon } from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { UploadProgress } from "saltbox-filesystem/store/file-browser-store";
import { formatFileSize } from "saltbox-filesystem/shared/utils";

const { Dragger } = Upload;

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  uploads: Map<string, UploadProgress>;
  onCancelUpload: (uploadId: string) => void;
  onClearFinished: () => void;
}

const statusIcon = (status: UploadProgress["status"]) => {
  switch (status) {
    case "done":
      return <MatIcon icon="check_circle" size="small" />;
    case "error":
      return <MatIcon icon="error" size="small" />;
    default:
      return null;
  }
};

export const UploadModal = observer(({
  open,
  onClose,
  onUpload,
  uploads,
  onCancelUpload,
  onClearFinished,
}: UploadModalProps) => {
  const { t } = useTranslation();

  const hasActive = Array.from(uploads.values()).some((u) => u.status === "uploading");
  const hasFinished = Array.from(uploads.values()).some((u) => u.status !== "uploading");

  const handleClose = () => {
    if (hasActive) return;
    onClearFinished();
    onClose();
  };

  return (
    <Modal
      title={t("upload.title")}
      open={open}
      onCancel={handleClose}
      maskClosable={!hasActive}
      destroyOnHidden={false}
      footer={
        uploads.size > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              {hasFinished && (
                <Button size="small" onClick={onClearFinished}>
                  {t("upload.clearFinished")}
                </Button>
              )}
            </div>
            <Button onClick={handleClose} disabled={hasActive}>
              {t("actions.close")}
            </Button>
          </div>
        ) : null
      }
    >
      <Dragger
        multiple
        showUploadList={false}
        beforeUpload={(file) => {
          onUpload(file);
          return false;
        }}
      >
        <p style={{ fontSize: 48, color: "#1677ff", margin: 0 }}>
          <MatIcon icon="cloud_upload" />
        </p>
        <p style={{ fontSize: 16, marginTop: 8 }}>{t("upload.dragText")}</p>
        <p style={{ color: "#888" }}>{t("upload.hint")}</p>
      </Dragger>

      {uploads.size > 0 && (
        <div style={{ marginTop: 16, maxHeight: 300, overflowY: "auto" }}>
          {Array.from(uploads.entries()).map(([id, upload]) => {
            const percent = upload.total > 0
              ? Math.round((upload.loaded / upload.total) * 100)
              : 0;

            return (
              <div
                key={id}
                style={{
                  padding: "8px 0",
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      color: upload.status === "done"
                        ? "#52c41a"
                        : upload.status === "error"
                          ? "#ff4d4f"
                          : "#1677ff",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {statusIcon(upload.status)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={upload.fileName}
                  >
                    {upload.fileName}
                  </span>
                  <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
                    {upload.status === "done"
                      ? formatFileSize(upload.total)
                      : `${formatFileSize(upload.loaded)} / ${formatFileSize(upload.total)}`}
                  </span>
                  {upload.status === "uploading" && (
                    <Button
                      type="text"
                      size="small"
                      danger
                      onClick={() => onCancelUpload(id)}
                      icon={<MatIcon icon="close" size="small" />}
                    />
                  )}
                </div>
                {upload.status === "uploading" && (
                  <Progress
                    percent={percent}
                    size="small"
                    showInfo={false}
                    style={{ marginTop: 4 }}
                  />
                )}
                {upload.status === "error" && upload.error && (
                  <div style={{ fontSize: 12, color: "#ff4d4f", marginTop: 2 }}>
                    {upload.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
});
