import { CopyOutlined, DownloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Modal } from "@saltbox/saltbox-frontend-common";
import { Button, message } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface FileActionsProps {
  name: string;
  currentPath: string;
  isDirectory: boolean;
  onDownload: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
}

function buildSaltPath(currentPath: string, name: string): string {
  const fullPath = currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
  return `salt://${fullPath.replace(/\/+/g, "/").replace(/^\//, "")}`;
}

export const FileActions = ({ name, currentPath, isDirectory, onDownload, onRename, onDelete }: FileActionsProps) => {
  const { t } = useTranslation();
  const [messageApi, contextHolder] = message.useMessage();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleCopySaltPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    const saltPath = buildSaltPath(currentPath, name);
    navigator.clipboard.writeText(saltPath).then(() => {
      messageApi.success(t("notifications.saltPathCopied", { path: saltPath }));
    });
  };

  return (
    <>
      {contextHolder}
      <div style={{ display: "flex", gap: "8px" }}>
        <Button
          type="default"
          icon={<CopyOutlined />}
          shape="circle"
          onClick={handleCopySaltPath}
          title={t("actions.copySaltPath")}
        />
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

     <div onClick={(e) => e.stopPropagation()}>
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
      </div>
    </>
  );
};
