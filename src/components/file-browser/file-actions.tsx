import { DownloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Modal } from "@saltbox/saltbox-frontend-common";
import { Button } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface FileActionsProps {
  name: string;
  isDirectory: boolean;
  onDownload: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
}

export const FileActions = ({ name, isDirectory, onDownload, onRename, onDelete }: FileActionsProps) => {
  const { t } = useTranslation();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  return (
    <>
      <div style={{ display: "flex", gap: "8px" }}>
        {!isDirectory && (
          <Button
            type="default"
            icon={<DownloadOutlined />}
            shape="circle"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(name);
            }}
            title={t("actions.download")}
          />
        )}
        <Button
          type="default"
          icon={<EditOutlined />}
          shape="circle"
          onClick={(e) => {
            e.stopPropagation();
            onRename(name);
          }}
          title={t("actions.rename")}
        />
        <Button
          danger
          icon={<DeleteOutlined />}
          shape="circle"
          onClick={(e) => {
            e.stopPropagation();
            setIsDeleteModalOpen(true);
          }}
          title={t("actions.delete")}
        />
      </div>

      <Modal
        title={t("actions.delete")}
        open={isDeleteModalOpen}
        onOk={() => {
          onDelete(name);
          setIsDeleteModalOpen(false);
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
        okText={t("actions.yes")}
        cancelText={t("actions.cancel")}
        okButtonProps={{ danger: true }}
      >
        <p>{t("actions.deleteConfirm")}</p>
      </Modal>
    </>
  );
};
