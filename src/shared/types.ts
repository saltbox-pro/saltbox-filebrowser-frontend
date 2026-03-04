export interface ItemInfo {
  name: string;
  size: number;
  modified: string;
  type: string;
  hasPreview: boolean;
  hidden: boolean;
}

export interface FileInfo extends ItemInfo {
  path: string;
  files?: ExtendedItemInfo[];
  folders?: ItemInfo[];
}

export interface ExtendedItemInfo extends ItemInfo {
  path?: string;
}

export interface SourceScope {
  name: string;
  scope: string;
}
