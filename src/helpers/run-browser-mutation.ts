import {
  FileBrowserSubmitError,
  isGlobalServerError,
  type FileBrowserNotificationSuccessKey,
  type ShowFileBrowserSuccessByKey,
} from "@saltbox/saltbox-frontend-common";

import { resolveFilesystemErrorCode, type FilesystemErrorCode } from "./filesystem-error";

export interface MutationNotify {
  showLocalError: (text: string) => void;
  showSuccessByKey: ShowFileBrowserSuccessByKey;
  resolveErrorText: (code: string) => string;
}

interface RunMutationOptions {
  run: () => Promise<void>;
  reload?: () => Promise<void>;
  successKey: FileBrowserNotificationSuccessKey;
  successParams?: Record<string, unknown>;
  notify: MutationNotify;
  fallbackErrorCode: FilesystemErrorCode;
}

function notifyError(
  notify: MutationNotify,
  error: unknown,
  fallbackErrorCode: FilesystemErrorCode
): void {
  const code = resolveFilesystemErrorCode(error, fallbackErrorCode);
  notify.showLocalError(notify.resolveErrorText(code));
}

export async function runNameMutation({
  run,
  reload,
  successKey,
  successParams,
  notify,
  fallbackErrorCode,
}: RunMutationOptions): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isGlobalServerError(error)) {
      throw error;
    }
    const code = resolveFilesystemErrorCode(error, fallbackErrorCode);
    throw new FileBrowserSubmitError(notify.resolveErrorText(code));
  }

  notify.showSuccessByKey({
    key: successKey,
    params: successParams,
    dismissStickyError: true,
  });
  scheduleListingReload(reload, notify);
}

export async function runToastMutation({
  run,
  reload,
  successKey,
  successParams,
  notify,
  fallbackErrorCode,
}: RunMutationOptions): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isGlobalServerError(error)) {
      throw error;
    }
    notifyError(notify, error, fallbackErrorCode);
    throw error;
  }

  notify.showSuccessByKey({
    key: successKey,
    params: successParams,
    dismissStickyError: true,
  });
  scheduleListingReload(reload, notify);
}

export function scheduleListingReload(
  reload: (() => Promise<void>) | undefined,
  notify: MutationNotify,
  fallbackErrorCode: FilesystemErrorCode = "listing-reload-error"
) {
  if (reload == null) {
    return;
  }

  reload().catch((error: unknown) => {
    if (isGlobalServerError(error)) {
      return;
    }
    notifyError(notify, error, fallbackErrorCode);
  });
}
