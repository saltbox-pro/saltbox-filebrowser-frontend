import type { TFunction } from "i18next";

import type { FilesystemErrorCode } from "./filesystem-error";

const LOCAL_ERROR_KEYS: Partial<Record<FilesystemErrorCode, string>> = {
  "fetch-user": "errors.fetchUser",
  "fetch-resource": "errors.fetchResource",
  "fetch-file-content": "errors.fetchFileContent",
  "server-error": "errors.serverError",
  "service-unavailable": "errors.serviceUnavailable",
  "network-error": "errors.networkError",
  "no-source": "errors.noSource",
  "read-only-source": "errors.readOnlySource",
  "invalid-name": "errors.invalidName",
};

export function formatLocalFilesystemError(
  t: TFunction<"base">,
  errorCode: string
): string | undefined {
  const localKey = LOCAL_ERROR_KEYS[errorCode as FilesystemErrorCode];
  return localKey != null ? t(localKey) : undefined;
}

export function resolveFilesystemErrorText(
  translateError: (code: string) => string | undefined,
  t: TFunction<"base">,
  code: string
): string {
  return translateError(code) ?? formatLocalFilesystemError(t, code) ?? code;
}
