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

export interface BulkDeleteItem {
  source: string;
  path: string;
  message?: string;
}

export interface BulkDeleteResponse {
  succeeded: BulkDeleteItem[];
  failed: BulkDeleteItem[];
}

export interface BulkDeleteFailedEntry {
  path: string;
  message?: string;
}

export type SelectedPaths = Record<string, boolean>;

export interface SourceScope {
  name: string;
  scope: string;
  readOnly: boolean;
}
