import { getFileBrowserErrorI18nKey } from "@saltbox/saltbox-frontend-common";
import type { TFunction } from "i18next";

import { resolveFilesystemErrorCode, type FilesystemErrorCode } from "./filesystem-error";

const LOCAL_ERROR_KEYS: Partial<Record<FilesystemErrorCode, string>> = {
  "fetch-user": "errors.fetchUser",
  "fetch-resource": "errors.fetchResource",
  "upload-chunk": "errors.uploadChunk",
  "fetch-file-content": "errors.fetchFileContent",
  "server-error": "errors.serverError",
  "service-unavailable": "errors.serviceUnavailable",
  "network-error": "errors.networkError",
  "no-source": "errors.noSource",
  "invalid-name": "errors.invalidName",
  "upload-cancelled": "upload.cancelled",
  "download-error": "download.error",
  "save-file-error": "editor.saveError",
};

export function formatFilesystemError(
  t: TFunction<"base">,
  tCommon: TFunction<"common">,
  errorCode: FilesystemErrorCode
): string {
  const commonKey = getFileBrowserErrorI18nKey(errorCode);
  if (commonKey != null) {
    return tCommon(commonKey);
  }
  const localKey = LOCAL_ERROR_KEYS[errorCode];
  return localKey != null ? t(localKey) : errorCode;
}

export function formatUnknownFilesystemError(
  t: TFunction<"base">,
  tCommon: TFunction<"common">,
  error: unknown,
  fallback: FilesystemErrorCode
): string {
  return formatFilesystemError(t, tCommon, resolveFilesystemErrorCode(error, fallback));
}
