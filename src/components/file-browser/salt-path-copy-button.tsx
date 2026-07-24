import { CopyOutlined } from "@ant-design/icons";
import { joinPathChild } from "@saltbox/saltbox-frontend-common";
import { Button } from "antd";
import type { MessageInstance } from "antd/es/message/interface";
import { memo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

interface SaltPathCopyButtonProps {
  name: string;
  currentPath: string;
  messageApi: MessageInstance;
}

function buildSaltPath(currentPath: string, name: string): string {
  const fullPath = joinPathChild(currentPath, name);
  return `salt://${fullPath.replace(/\/+/g, "/").replace(/^\//, "")}`;
}

export const SaltPathCopyButton = memo(function SaltPathCopyButton({
  name,
  currentPath,
  messageApi,
}: SaltPathCopyButtonProps) {
  const { t } = useTranslation();

  const handleCopy = (event: MouseEvent) => {
    event.stopPropagation();
    const saltPath = buildSaltPath(currentPath, name);
    navigator.clipboard
      .writeText(saltPath)
      .then(() => {
        messageApi.success(t("notifications.saltPathCopied", { path: saltPath }));
      })
      .catch(() => {
        messageApi.error(t("notifications.saltPathCopyError"));
      });
  };

  return (
    <Button
      type="default"
      icon={<CopyOutlined />}
      shape="circle"
      onClick={handleCopy}
      title={t("actions.copySaltPath")}
      aria-label={t("actions.copySaltPath")}
    />
  );
});
