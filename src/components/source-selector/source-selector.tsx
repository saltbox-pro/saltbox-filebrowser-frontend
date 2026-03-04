import { FolderOutlined } from "@ant-design/icons";
import { Menu, Spin } from "antd";
import { observer } from "mobx-react";
import { useTranslation } from "react-i18next";

import { SourceScope } from "saltbox-filesystem/shared/types";

interface SourceSelectorProps {
  sources: SourceScope[];
  currentSource: string;
  loading?: boolean;
  onSourceChange: (source: string) => void;
}

export const SourceSelector = observer(({ sources, currentSource, loading, onSourceChange }: SourceSelectorProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <Spin size="small" />
      </div>
    );
  }

  return (
    <Menu
      mode="inline"
      selectedKeys={currentSource ? [currentSource] : []}
      onClick={({ key }) => onSourceChange(key)}
      style={{ borderInlineEnd: "none" }}
      items={sources.map((s) => ({
        key: s.name,
        icon: <FolderOutlined />,
        label: s.name,
      }))}
    />
  );
});
