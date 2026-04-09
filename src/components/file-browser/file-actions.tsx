import { DownloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { Button, Popconfirm } from "antd";
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

  return (
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
      <Popconfirm
        title={t("actions.deleteConfirm")}
        onConfirm={(e) => {
          e?.stopPropagation();
          onDelete(name);
        }}
        onCancel={(e) => e?.stopPropagation()}
        okText={t("actions.yes")}
        cancelText={t("actions.no")}
      >
        <Button
          danger
          icon={<DeleteOutlined />}
          shape="circle"
          onClick={(e) => e.stopPropagation()}
          title={t("actions.delete")}
        />
      </Popconfirm>
    </div>
  );
};
