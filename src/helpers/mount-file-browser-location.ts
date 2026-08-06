import type { FileBrowserLocationQuery } from "@saltbox/saltbox-frontend-common";

import type { FilesystemErrorCode } from "saltbox-filesystem/helpers/filesystem-error";
import { fileBrowserStore } from "saltbox-filesystem/store/file-browser-store";

export type MountFileBrowserLocationResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "no-sources"
        | "unknown-source"
        | "path-not-found"
        | "directory-unavailable"
        | "file-missing";
      requestedPath?: string;
    };

function normalizeLocationPath(path: string): string {
  if (path === "/") {
    return "/";
  }
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return "/";
  }
  const withoutTrailing = trimmed.replace(/\/+$/, "");
  return withoutTrailing.startsWith("/") ? withoutTrailing : `/${withoutTrailing}`;
}

function classifyListingFailure(
  error: FilesystemErrorCode | undefined
): "path-not-found" | "directory-unavailable" {
  if (
    error === "network-error" ||
    error === "service-unavailable" ||
    error === "server-error" ||
    error === "fetch-user"
  ) {
    return "directory-unavailable";
  }
  return "path-not-found";
}

export async function mountFileBrowserLocation(
  location: FileBrowserLocationQuery,
  openFile: (name: string) => void
): Promise<MountFileBrowserLocationResult> {
  const sourcesOk = await fileBrowserStore.loadSources();
  if (!sourcesOk) {
    return { ok: false, reason: "no-sources" };
  }

  const defaultSource = fileBrowserStore.currentSource;
  const sourceFromUrl = location.source;

  if (sourceFromUrl != null) {
    const sourceExists = fileBrowserStore.sources.some((source) => source.name === sourceFromUrl);
    if (!sourceExists) {
      await fileBrowserStore.loadDirectory(defaultSource, "/");
      return { ok: false, reason: "unknown-source" };
    }
  }

  const targetSource = sourceFromUrl ?? defaultSource;
  const targetPath = normalizeLocationPath(location.path ?? "/");

  await fileBrowserStore.loadDirectory(targetSource, targetPath);

  const listingOk =
    fileBrowserStore.error == null &&
    fileBrowserStore.currentSource === targetSource &&
    normalizeLocationPath(fileBrowserStore.currentPath) === targetPath;

  if (!listingOk) {
    const errorCode = fileBrowserStore.error;
    const reason = classifyListingFailure(errorCode);
    if (reason === "directory-unavailable") {
      await fileBrowserStore.loadDirectory(targetSource || defaultSource, "/");
      return {
        ok: false,
        reason,
        requestedPath: targetPath,
      };
    }

    await fileBrowserStore.loadDirectory(targetSource || defaultSource, "/");
    return {
      ok: false,
      reason: "path-not-found",
      requestedPath: targetPath,
    };
  }

  if (location.file != null) {
    const entry = fileBrowserStore.files.find(
      (file) => file.name === location.file && !file.isDirectory
    );
    if (entry == null) {
      return { ok: false, reason: "file-missing" };
    }
    openFile(entry.name);
  }

  return { ok: true };
}
