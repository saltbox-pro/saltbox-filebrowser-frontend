import {
  isFileBrowserSafePathSegment,
  joinFileBrowserPathChild,
} from "@saltbox/saltbox-frontend-common";

export function toEntryPath(directoryPath: string, name: string): string | null {
  if (!isFileBrowserSafePathSegment(name)) {
    return null;
  }
  return joinFileBrowserPathChild(directoryPath, name);
}

export function isNestedPath(path: string, rootPath: string): boolean {
  return path.startsWith(`${rootPath.replace(/\/+$/, "")}/`);
}

export function isEntryInDirectory(entryPath: string, directoryPath: string): boolean {
  const name = entryPath.slice(entryPath.lastIndexOf("/") + 1);
  return toEntryPath(directoryPath, name) === entryPath;
}
