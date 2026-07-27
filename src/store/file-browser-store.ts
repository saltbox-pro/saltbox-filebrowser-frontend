import {
  isGlobalServerError,
  isFileBrowserSafePathSegment,
  joinFileBrowserPathChild,
} from "@saltbox/saltbox-frontend-common";
import { action, computed, makeObservable, observable, runInAction } from "mobx";

import {
  FilesystemError,
  LISTING_RELOAD_ERROR_CODE,
  resolveFilesystemErrorCode,
  type FileBrowserEntryKind,
  type FilesystemErrorCode,
} from "saltbox-filesystem/helpers/filesystem-error";
import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";

import { apiFilesystemStore } from "./api-filesystem-store";
import { fileEditorStore } from "./file-editor-store";

const CHUNK_THRESHOLD = 5 * 1024 * 1024;

export interface FileEntry {
  name: string;
  size: number;
  modified: string;
  type: string;
  isDirectory: boolean;
}

export interface UploadProgress {
  fileName: string;
  loaded: number;
  total: number;
  status: "uploading" | "done" | "error";
  error?: FilesystemErrorCode;
  abortController: AbortController;
}

class FileBrowserStore {
  @observable currentPath: string = "/";
  @observable currentSource: string = "";
  @observable sources: SourceScope[] = [];
  @observable files: FileEntry[] = [];
  @observable isLoading: boolean = false;
  @observable sourcesLoading: boolean = false;
  @observable error: FilesystemErrorCode | undefined;
  @observable uploads: Map<string, UploadProgress> = new Map();
  @observable private mutationCount = 0;
  @observable private pendingListingReloadCount = 0;

  private loadId = 0;
  private listingInFlight = 0;
  private listingLoadChain: Promise<void> = Promise.resolve();

  constructor() {
    makeObservable(this);
  }

  @computed get hasActiveUploads(): boolean {
    return Array.from(this.uploads.values()).some((u) => u.status === "uploading");
  }

  @computed get isMutating(): boolean {
    return this.mutationCount > 0;
  }

  @computed get isBusy(): boolean {
    return (
      this.isLoading ||
      this.sourcesLoading ||
      this.isMutating ||
      this.hasActiveUploads ||
      this.pendingListingReloadCount > 0
    );
  }

  @computed get hasPendingListingReload(): boolean {
    return this.pendingListingReloadCount > 0;
  }

  @computed get isCurrentSourceReadOnly(): boolean {
    return this.isSourceReadOnly(this.currentSource);
  }

  isSourceReadOnly(name: string): boolean {
    return this.sources.find((source) => source.name === name)?.readOnly === true;
  }

  @action
  async loadSources(): Promise<boolean> {
    this.sourcesLoading = true;
    try {
      const scopes = await apiFilesystemStore.getScopes();
      runInAction(() => {
        this.sources = scopes;
        if (scopes.length > 0 && !this.currentSource) {
          this.currentSource = scopes[0].name;
        }
        this.sourcesLoading = false;
        this.error = undefined;
      });
      return this.currentSource !== "";
    } catch (e: unknown) {
      runInAction(() => {
        this.sourcesLoading = false;
        if (!isGlobalServerError(e)) {
          this.error = resolveFilesystemErrorCode(e, "fetch-user");
        }
      });
      return false;
    }
  }

  @action
  async loadDirectory(source?: string, path?: string): Promise<void> {
    try {
      await this.enqueueListingLoad(() => this.performLoadDirectory(source, path));
    } catch {
      return;
    }
  }

  private enqueueListingLoad(task: () => Promise<void>): Promise<void> {
    runInAction(() => {
      this.listingInFlight += 1;
      this.isLoading = true;
    });
    const run = this.listingLoadChain.then(task, task).finally(() => {
      runInAction(() => {
        this.listingInFlight = Math.max(0, this.listingInFlight - 1);
        this.isLoading = this.listingInFlight > 0;
      });
    });
    this.listingLoadChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async performLoadDirectory(source?: string, path?: string): Promise<void> {
    const targetSource = source ?? this.currentSource;
    const targetPath = path ?? this.currentPath;
    if (!targetSource) {
      return;
    }

    const loadId = ++this.loadId;
    runInAction(() => {
      this.error = undefined;
    });

    try {
      const data = await apiFilesystemStore.getResource(targetSource, targetPath);
      runInAction(() => {
        if (loadId !== this.loadId) {
          return;
        }
        this.currentSource = targetSource;
        this.currentPath = targetPath;
        this.files = this.mapToEntries(data);
      });
    } catch (e: unknown) {
      runInAction(() => {
        if (loadId !== this.loadId) {
          return;
        }
        if (isGlobalServerError(e)) {
          return;
        }
        this.error = resolveFilesystemErrorCode(e, "fetch-resource");
      });
      if (isGlobalServerError(e)) {
        throw e;
      }
      throw new FilesystemError(resolveFilesystemErrorCode(e, "fetch-resource"));
    }
  }

  private assertSourceLocation(): { source: string; path: string } {
    if (!this.currentSource) {
      throw new FilesystemError("no-source");
    }
    return { source: this.currentSource, path: this.currentPath };
  }

  private assertCanMutate(): { source: string; path: string } {
    if (this.isBusy) {
      throw new FilesystemError("operation-busy");
    }
    if (this.isCurrentSourceReadOnly) {
      throw new FilesystemError("read-only-source");
    }
    return this.assertSourceLocation();
  }

  private assertCanUpload(): { source: string; path: string } {
    if (
      fileEditorStore.isSaving ||
      this.isLoading ||
      this.sourcesLoading ||
      this.isMutating ||
      this.pendingListingReloadCount > 0
    ) {
      throw new FilesystemError("operation-busy");
    }
    if (this.isCurrentSourceReadOnly) {
      throw new FilesystemError("read-only-source");
    }
    return this.assertSourceLocation();
  }

  private beginMutation = () => {
    this.mutationCount += 1;
  };

  private endMutation = () => {
    this.mutationCount = Math.max(0, this.mutationCount - 1);
  };

  private markListingReloadPending = () => {
    this.pendingListingReloadCount += 1;
  };

  private async withMutation(
    run: (location: { source: string; path: string }) => Promise<void>,
    options?: { expectListingReload?: boolean }
  ) {
    const location = this.assertCanMutate();
    runInAction(() => {
      this.beginMutation();
    });
    try {
      await run(location);
      if (options?.expectListingReload) {
        runInAction(() => {
          this.markListingReloadPending();
        });
      }
    } finally {
      runInAction(() => {
        this.endMutation();
      });
    }
  }

  private async reloadCurrentDirectory(): Promise<void> {
    await this.enqueueListingLoad(() =>
      this.performLoadDirectory(this.currentSource, this.currentPath)
    );
  }

  private async reloadAfterMutation(): Promise<void> {
    try {
      await this.reloadCurrentDirectory();
    } catch (error: unknown) {
      runInAction(() => {
        this.error = isGlobalServerError(error) ? undefined : LISTING_RELOAD_ERROR_CODE;
      });
      if (isGlobalServerError(error)) {
        throw error;
      }
      throw new FilesystemError(LISTING_RELOAD_ERROR_CODE);
    }
  }

  @action
  async createFolder(name: string): Promise<void> {
    await this.withMutation(
      async ({ source, path }) => {
        await apiFilesystemStore.createResource(source, joinFileBrowserPathChild(path, name), {
          isDir: true,
        });
      },
      { expectListingReload: true }
    );
  }

  @action
  async createFile(name: string): Promise<void> {
    await this.withMutation(
      async ({ source, path }) => {
        const emptyFile = new File([""], name, { type: "text/plain" });
        await apiFilesystemStore.createResource(source, joinFileBrowserPathChild(path, name), {
          file: emptyFile,
        });
      },
      { expectListingReload: true }
    );
  }

  @action
  async uploadFile(file: File, override?: boolean): Promise<void> {
    const uploadId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const abortController = new AbortController();
    let wroteBytes = false;

    try {
      const location = this.assertCanUpload();
      if (!isFileBrowserSafePathSegment(file.name)) {
        throw new FilesystemError("invalid-name");
      }
      const filePath = joinFileBrowserPathChild(location.path, file.name);

      runInAction(() => {
        this.uploads.set(uploadId, {
          fileName: file.name,
          loaded: 0,
          total: file.size,
          status: "uploading",
          abortController,
        });
      });

      if (file.size <= CHUNK_THRESHOLD) {
        await apiFilesystemStore.createResource(location.source, filePath, {
          file,
          override,
          signal: abortController.signal,
          errorCode: "upload-chunk",
        });
        wroteBytes = true;
      } else {
        try {
          await apiFilesystemStore.uploadFileChunked(location.source, filePath, {
            file,
            override,
            signal: abortController.signal,
            onProgress: (loaded) => {
              wroteBytes = loaded > 0;
              runInAction(() => {
                const upload = this.uploads.get(uploadId);
                if (upload) {
                  upload.loaded = loaded;
                }
              });
            },
          });
          wroteBytes = true;
        } catch (chunkError: unknown) {
          if (wroteBytes) {
            try {
              await apiFilesystemStore.deleteResource(location.source, filePath, "file");
            } catch {
              runInAction(() => {
                this.markListingReloadPending();
              });
            }
          }
          throw chunkError;
        }
      }
      runInAction(() => {
        const upload = this.uploads.get(uploadId);
        if (upload) {
          upload.status = "done";
          upload.loaded = upload.total;
        }
        this.markListingReloadPending();
      });
    } catch (e: unknown) {
      runInAction(() => {
        const upload = this.uploads.get(uploadId);
        if (!upload) {
          return;
        }
        upload.status = "error";
        if (!isGlobalServerError(e)) {
          upload.error = resolveFilesystemErrorCode(e, "upload-chunk");
        }
      });
      throw e;
    }
  }

  reloadListingAfterMutation = (): Promise<void> => {
    runInAction(() => {
      if (this.pendingListingReloadCount < 1) {
        this.pendingListingReloadCount = 1;
      }
    });
    return this.reloadAfterMutation().finally(() => {
      runInAction(() => {
        this.pendingListingReloadCount = Math.max(0, this.pendingListingReloadCount - 1);
      });
    });
  };

  @action
  cancelUpload(uploadId: string): void {
    const upload = this.uploads.get(uploadId);
    if (upload && upload.status === "uploading") {
      upload.abortController.abort();
    }
  }

  @action
  clearFinishedUploads(): void {
    for (const [id, upload] of this.uploads) {
      if (upload.status !== "uploading") {
        this.uploads.delete(id);
      }
    }
  }

  @action
  async renameItem(oldName: string, newName: string, kind: FileBrowserEntryKind): Promise<void> {
    await this.withMutation(
      async ({ source, path }) => {
        await apiFilesystemStore.renameResource(
          source,
          joinFileBrowserPathChild(path, oldName),
          joinFileBrowserPathChild(path, newName),
          kind
        );
      },
      { expectListingReload: true }
    );
  }

  @action
  async deleteItem(name: string, kind: FileBrowserEntryKind): Promise<void> {
    await this.withMutation(
      async ({ source, path }) => {
        await apiFilesystemStore.deleteResource(source, joinFileBrowserPathChild(path, name), kind);
      },
      { expectListingReload: true }
    );
  }

  async downloadItem(name: string, signal?: AbortSignal): Promise<void> {
    const location = this.assertSourceLocation();
    await apiFilesystemStore.downloadFile(
      location.source,
      joinFileBrowserPathChild(location.path, name),
      signal
    );
  }

  private mapToEntries(data: FileInfo | undefined): FileEntry[] {
    if (!data) {
      return [];
    }
    const entries: FileEntry[] = [];

    if (data.folders) {
      for (const folder of data.folders) {
        entries.push({
          name: folder.name,
          size: folder.size,
          modified: folder.modified,
          type: "directory",
          isDirectory: true,
        });
      }
    }

    if (data.files) {
      for (const file of data.files) {
        entries.push({
          name: file.name,
          size: file.size,
          modified: file.modified,
          type: file.type,
          isDirectory: false,
        });
      }
    }

    return entries;
  }
}

export const fileBrowserStore = new FileBrowserStore();
