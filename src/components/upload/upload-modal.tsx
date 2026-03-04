import { Modal, Upload, message } from "antd";
import { MatIcon } from "@saltbox/saltbox-frontend-common";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const { Dragger } = Upload;

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
}

export const UploadModal = ({ open, onClose, onUpload }: UploadModalProps) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
      message.success(`${file.name} ${t("upload.success")}`);
    } catch (e: any) {
      message.error(`${file.name} ${t("upload.failed")}: ${e.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={t("upload.title")}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Dragger
        multiple
        showUploadList
        disabled={uploading}
        beforeUpload={(file) => {
          handleUpload(file);
          return false;
        }}
      >
        <p style={{ fontSize: 48, color: "#1677ff", margin: 0 }}>
          <MatIcon icon="cloud_upload" />
        </p>
        <p style={{ fontSize: 16, marginTop: 8 }}>{t("upload.dragText")}</p>
        <p style={{ color: "#888" }}>{t("upload.hint")}</p>
      </Dragger>
    </Modal>
  );
};
