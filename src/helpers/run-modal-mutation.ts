import {
  FileBrowserKeepModalOpenError,
  FileBrowserSubmitError,
  isAbortError,
  normalizeApiError,
  notify,
} from "@saltbox/saltbox-frontend-common";

import { isFilesystemError } from "./filesystem-error";

export async function runModalMutation(options: {
  run: () => Promise<void>;
  successMessage: string;
  errorFallback: string;
  reload: () => void | Promise<void>;
  resolveClientError: (code: string) => string;
}): Promise<void> {
  try {
    await options.run();
  } catch (error: unknown) {
    if (isAbortError(error)) {
      throw new FileBrowserKeepModalOpenError();
    }
    if (isFilesystemError(error)) {
      throw new FileBrowserSubmitError(options.resolveClientError(error.code));
    }
    const appError = await normalizeApiError(error);
    if (appError.status === 409 || appError.kind === "conflict") {
      throw new FileBrowserSubmitError(options.resolveClientError("name-already-exists"));
    }
    throw new FileBrowserSubmitError(options.errorFallback, appError);
  }
  await options.reload();
  notify.success(options.successMessage);
}
