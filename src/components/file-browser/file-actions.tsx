import { Button, Popconfirm, Space } from "antd";
import { MatIcon } from "@saltbox/saltbox-frontend-common";
import { useTranslation } from "react-i18next";

interface FileActionsProps {
  name: string;
  isDirectory: boolean;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
}

export const FileActions = ({ name, isDirectory, onDownload, onDelete }: FileActionsProps) => {
  const { t } = useTranslation();

  return (
    <Space>
      {!isDirectory && (
        <Button
          type="text"
          size="small"
          icon={<MatIcon icon="download" />}
          onClick={(e) => {
            e.stopPropagation();
            onDownload(name);
          }}
          title={t("actions.download")}
        />
      )}
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
          type="text"
          size="small"
          danger
          icon={<MatIcon icon="delete" />}
          onClick={(e) => e.stopPropagation()}
          title={t("actions.delete")}
        />
      </Popconfirm>
    </Space>
  );
};
