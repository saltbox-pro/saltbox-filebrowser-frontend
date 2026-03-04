import { Breadcrumb } from "antd";
import { MatIcon } from "@saltbox/saltbox-frontend-common";
import { observer } from "mobx-react";

interface BreadcrumbNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const BreadcrumbNav = observer(({ currentPath, onNavigate }: BreadcrumbNavProps) => {
  const segments = currentPath.split("/").filter(Boolean);

  const items = [
    {
      title: (
        <a onClick={() => onNavigate("/")}>
          <MatIcon icon="home" size="small" />
        </a>
      ),
    },
    ...segments.map((segment, index) => {
      const path = "/" + segments.slice(0, index + 1).join("/");
      const isLast = index === segments.length - 1;
      return {
        title: isLast ? (
          segment
        ) : (
          <a onClick={() => onNavigate(path)}>{segment}</a>
        ),
      };
    }),
  ];

  return <Breadcrumb items={items} style={{ margin: 0 }} />;
});
