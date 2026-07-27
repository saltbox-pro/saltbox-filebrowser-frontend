import {
  type FileBrowserItem,
  isFileBrowserSafePathSegment,
  joinFileBrowserPathChild,
} from "@saltbox/saltbox-frontend-common";

import type { FileEntry } from "saltbox-filesystem/store/file-browser-store";

function parseModifiedAt(modified: string | number | undefined): number | null {
  if (modified == null || modified === "") {
    return null;
  }

  if (typeof modified === "number") {
    if (!Number.isFinite(modified) || modified <= 0) {
      return null;
    }
    if (modified > 1e14) {
      return Math.floor(modified / 1_000_000);
    }
    if (modified > 1e12) {
      return Math.floor(modified / 1000);
    }
    return Math.floor(modified);
  }

  const trimmed = modified.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    return parseModifiedAt(Number(trimmed));
  }

  const timestamp = Date.parse(trimmed);
  if (!Number.isNaN(timestamp)) {
    return Math.floor(timestamp / 1000);
  }

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const normalizedTimestamp = Date.parse(normalized);
  if (!Number.isNaN(normalizedTimestamp)) {
    return Math.floor(normalizedTimestamp / 1000);
  }

  return null;
}

export function toFileBrowserItem(entry: FileEntry, currentPath: string): FileBrowserItem | null {
  if (!isFileBrowserSafePathSegment(entry.name)) {
    return null;
  }

  const path = joinFileBrowserPathChild(currentPath, entry.name);

  return {
    id: path,
    name: entry.name,
    path,
    kind: entry.isDirectory ? "directory" : "file",
    sizeBytes: entry.isDirectory ? null : entry.size,
    modifiedAt: parseModifiedAt(entry.modified),
    iconHint: entry.type,
  };
}
