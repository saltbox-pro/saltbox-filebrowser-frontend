import { FileBrowserSubmitError, isGlobalServerError } from "@saltbox/saltbox-frontend-common";

interface MutationNotifier {
  success: (content: string) => void;
  error: (content: string) => void;
}

interface RunMutationOptions {
  run: () => Promise<void>;
  reload?: () => Promise<void>;
  successMessage: string;
  formatError: (error: unknown) => string;
  messageApi: MutationNotifier;
}

export async function runNameMutation({
  run,
  reload,
  successMessage,
  formatError,
  messageApi,
}: RunMutationOptions): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isGlobalServerError(error)) {
      throw error;
    }
    throw new FileBrowserSubmitError(formatError(error));
  }

  messageApi.success(successMessage);
  scheduleListingReload(reload, formatError, messageApi);
}

export async function runToastMutation({
  run,
  reload,
  successMessage,
  formatError,
  messageApi,
}: RunMutationOptions): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (isGlobalServerError(error)) {
      throw error;
    }
    messageApi.error(formatError(error));
    throw error;
  }

  messageApi.success(successMessage);
  scheduleListingReload(reload, formatError, messageApi);
}

export function scheduleListingReload(
  reload: (() => Promise<void>) | undefined,
  formatError: (error: unknown) => string,
  messageApi: Pick<MutationNotifier, "error">
) {
  if (reload == null) {
    return;
  }

  reload().catch((error: unknown) => {
    if (isGlobalServerError(error)) {
      return;
    }
    messageApi.error(formatError(error));
  });
}
