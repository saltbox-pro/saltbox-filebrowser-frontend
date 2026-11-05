import {
  FileBrowserKeepModalOpenError,
  FileBrowserSubmitError,
  isAbortError,
  normalizeApiError,
  notify,
} from "@saltbox/saltbox-frontend-common";

import { isFilesystemError } from "./filesystem-error";

interface ModalSubmitErrorOptions {
  errorFallback: string;
  resolveClientError: (code: string) => string;
}

export async function toModalSubmitError(
  error: unknown,
  options: ModalSubmitErrorOptions
): Promise<Error> {
  if (isAbortError(error)) {
    return new FileBrowserKeepModalOpenError();
  }
  if (isFilesystemError(error)) {
    return new FileBrowserSubmitError(options.resolveClientError(error.code));
  }
  const appError = await normalizeApiError(error);
  if (appError.status === 409 || appError.kind === "conflict") {
    return new FileBrowserSubmitError(options.resolveClientError("name-already-exists"));
  }
  return new FileBrowserSubmitError(options.errorFallback, appError);
}

export async function runModalMutation(
  options: ModalSubmitErrorOptions & {
    run: () => Promise<void>;
    successMessage: string;
    reload: () => void | Promise<void>;
  }
): Promise<void> {
  try {
    await options.run();
  } catch (error: unknown) {
    throw await toModalSubmitError(error, options);
  }
  await options.reload();
  notify.success(options.successMessage);
}
