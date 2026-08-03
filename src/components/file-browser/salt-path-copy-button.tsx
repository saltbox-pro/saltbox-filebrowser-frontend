import { CopyOutlined } from "@ant-design/icons";
import {
  joinFileBrowserPathChild,
  type ShowFileBrowserErrorByCode,
  type ShowFileBrowserSuccessByKey,
} from "@saltbox/saltbox-frontend-common";
import { Button } from "antd";
import { memo, type MouseEvent } from "react";

interface SaltPathCopyButtonProps {
  name: string;
  currentPath: string;
  copySaltPathLabel: string;
  showErrorByCode: ShowFileBrowserErrorByCode;
  showSuccessByKey: ShowFileBrowserSuccessByKey;
}

function buildSaltPath(currentPath: string, name: string): string {
  const fullPath = joinFileBrowserPathChild(currentPath, name);
  return `salt://${fullPath.replace(/\/+/g, "/").replace(/^\//, "")}`;
}

export const SaltPathCopyButton = memo(function SaltPathCopyButton({
  name,
  currentPath,
  copySaltPathLabel,
  showErrorByCode,
  showSuccessByKey,
}: SaltPathCopyButtonProps) {
  const handleCopy = (event: MouseEvent) => {
    event.stopPropagation();
    const saltPath = buildSaltPath(currentPath, name);
    navigator.clipboard
      .writeText(saltPath)
      .then(() => {
        showSuccessByKey({
          key: "salt-path-copied",
          params: { path: saltPath },
        });
      })
      .catch(() => {
        showErrorByCode({ code: "salt-path-copy-error" });
      });
  };

  return (
    <Button
      type="default"
      icon={<CopyOutlined />}
      shape="circle"
      onClick={handleCopy}
      title={copySaltPathLabel}
      aria-label={copySaltPathLabel}
    />
  );
});
