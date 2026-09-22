import { isNetworkTypeError } from "@saltbox/saltbox-frontend-common";

export type FileBrowserEntryKind = "file" | "directory";

export const FILESYSTEM_ERROR_CODES = [
  "fetch-user",
  "fetch-resource",
  "upload-chunk",
  "fetch-file-content",
  "network-error",
  "no-source",
  "operation-busy",
  "read-only-source",
  "invalid-name",
  "upload-cancelled",
  "upload-already-in-progress",
  "download-error",
  "download-cancelled",
  "download-already-in-progress",
  "file-too-large-to-download",
  "name-already-exists",
  "create-error",
  "file-write-error",
  "remove-error",
  "rename-error",
] as const;

export type FilesystemErrorCode = (typeof FILESYSTEM_ERROR_CODES)[number];

const FILESYSTEM_ERROR_CODE_SET: ReadonlySet<string> = new Set(FILESYSTEM_ERROR_CODES);

export class FilesystemError extends Error {
  readonly code: FilesystemErrorCode;

  constructor(code: FilesystemErrorCode) {
    super(code);
    this.name = "FilesystemError";
    this.code = code;
  }
}

export function isFilesystemError(error: unknown): error is FilesystemError {
  return error instanceof FilesystemError;
}

export function isFilesystemErrorCode(value: unknown): value is FilesystemErrorCode {
  return typeof value === "string" && FILESYSTEM_ERROR_CODE_SET.has(value);
}

function getResponseStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if ((error as { name?: string }).name !== "ResponseError") {
    return undefined;
  }
  const response = (error as { response?: Response }).response;
  return response && typeof response.status === "number" ? response.status : undefined;
}

export function resolveFilesystemErrorCode(
  error: unknown,
  fallback: FilesystemErrorCode
): FilesystemErrorCode {
  if (isFilesystemError(error)) {
    return error.code;
  }
  if (isFilesystemErrorCode(error)) {
    return error;
  }
  if (error instanceof Error && error.message === "Invalid path segment") {
    return "invalid-name";
  }
  if (isNetworkTypeError(error)) {
    return "network-error";
  }
  if (error instanceof Error && error.name === "AbortError") {
    if (fallback === "upload-chunk" || fallback === "upload-cancelled") {
      return "upload-cancelled";
    }
    if (fallback === "download-error" || fallback === "download-cancelled") {
      return "download-cancelled";
    }
    return fallback;
  }
  if (error instanceof Error && error.name === "BrowserFileDownloadTooLargeError") {
    return "file-too-large-to-download";
  }

  const status = getResponseStatus(error);
  if (status === 409) {
    return "name-already-exists";
  }

  return fallback;
}

export const CREATE_ERROR_CODE = "create-error" satisfies FilesystemErrorCode;

export const REMOVE_ERROR_CODE = "remove-error" satisfies FilesystemErrorCode;

export const RENAME_ERROR_CODE = "rename-error" satisfies FilesystemErrorCode;
