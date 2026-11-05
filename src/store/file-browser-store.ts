import {
  abortBrowserFileDownloadTarget,
  createLoader,
  hasActiveFileBrowserTransfer,
  isFileBrowserTransferCancellable,
  isFileBrowserTransferInProgress,
  isFileBrowserSafePathSegment,
  joinFileBrowserPathChild,
  normalizeApiError,
  shouldEmitUploadProgress,
  type BrowserFileDownloadTarget,
  type FileBrowserDownloadItem,
  type FileBrowserUploadItem,
} from "@saltbox/saltbox-frontend-common";
import { action, computed, makeObservable, observable, runInAction } from "mobx";

import { UPLOAD_CHUNK_SIZE } from "saltbox-filesystem/constants/upload";
import {
  pickBulkDeleteFailures,
  pickExistingSelectedPaths,
} from "saltbox-filesystem/helpers/bulk-delete";
import { createTransferId } from "saltbox-filesystem/helpers/create-transfer-id";
import {
  isEntryInDirectory,
  isNestedPath,
  toEntryPath,
} from "saltbox-filesystem/helpers/entry-path";
import {
  FilesystemError,
  isFilesystemError,
  resolveFilesystemErrorCode,
  type FileBrowserEntryKind,
  type FilesystemErrorCode,
} from "saltbox-filesystem/helpers/filesystem-error";
import {
  BulkDeleteFailedEntry,
  FileInfo,
  SelectedPaths,
  SourceScope,
} from "saltbox-filesystem/shared/types";

import { apiFilesystemStore } from "./api-filesystem-store";
import { fileEditorStore } from "./file-editor-store";

export interface FileEntry {
  name: string;
  size: number;
  modified: string;
  type: string;
  isDirectory: boolean;
}

export interface UploadProgress extends FileBrowserUploadItem {
  error?: FilesystemErrorCode;
  abortController: AbortController;
  source: string;
}

export interface DownloadProgress extends FileBrowserDownloadItem {
  error?: FilesystemErrorCode;
  abortController: AbortController;
  source: string;
}

class FileBrowserStore {
  @observable currentPath: string = "/";
  @observable currentSource: string = "";
  @observable sources: SourceScope[] = [];
  @observable files: FileEntry[] = [];
  @observable selectedPaths: SelectedPaths = {};
  @observable uploads: Map<string, UploadProgress> = new Map();
  @observable downloads: Map<string, DownloadProgress> = new Map();
  @observable uploadModalOpen = false;
  @observable private mutationCount = 0;
  @observable private pendingListingReloadCount = 0;
  @observable private listingInFlight = 0;

  private listingLoadChain: Promise<void> = Promise.resolve();
  private lastDirectoryLoadArgs: [string, string] | null = null;

  readonly sourcesLoad = createLoader({
    run: () => apiFilesystemStore.getScopes(),
    onSuccess: (scopes) => {
      this.sources = scopes;
      if (scopes.length > 0 && !this.currentSource) {
        this.currentSource = scopes[0].name;
      }
    },
  });

  readonly directoryLoad = createLoader({
    run: (source: string, path: string) => {
      this.lastDirectoryLoadArgs = [source, path];
      return apiFilesystemStore.getResource(source, path);
    },
    onSuccess: (data, source, path) => {
      const locationChanged = source !== this.currentSource || path !== this.currentPath;
      this.currentSource = source;
      this.currentPath = path;
      this.files = this.mapToEntries(data);
      this.selectedPaths = locationChanged ? {} : this.pruneSelectedPaths();
    },
  });

  constructor() {
    makeObservable(this);
    this.directoryLoad.retry = () => {
      const args = this.lastDirectoryLoadArgs;
      if (args == null) {
        return;
      }
      this.enqueueListingLoad(() =>
        this.directoryLoad.run(args[0], args[1]).catch(() => undefined)
      );
    };
  }

  @computed get hasActiveUploads(): boolean {
    return hasActiveFileBrowserTransfer(this.uploads);
  }

  @computed get activeUploadTargetDirectory(): string | null {
    for (const upload of this.uploads.values()) {
      if (isFileBrowserTransferInProgress(upload.status)) {
        return upload.targetDirectory ?? null;
      }
    }
    return null;
  }

  @computed get isMutating(): boolean {
    return this.mutationCount > 0;
  }

  @computed get isLoading(): boolean {
    return this.directoryLoad.isLoading || this.listingInFlight > 0;
  }

  @computed get sourcesLoading(): boolean {
    return this.sourcesLoad.isLoading;
  }

  @computed get isBusy(): boolean {
    return (
      this.isLoading || this.sourcesLoading || this.isMutating || this.pendingListingReloadCount > 0
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

  loadSources = async (): Promise<boolean> => {
    await this.sourcesLoad.run().catch(() => undefined);
    return this.sourcesLoad.status === "success" && this.currentSource !== "";
  };

  loadDirectory = async (source?: string, path?: string): Promise<void> => {
    await this.enqueueListingLoad(() => this.performLoadDirectory(source, path));
  };

  private enqueueListingLoad(task: () => Promise<void>): Promise<void> {
    runInAction(() => {
      this.listingInFlight += 1;
    });
    const run = this.listingLoadChain.then(task, task).finally(() => {
      runInAction(() => {
        this.listingInFlight = Math.max(0, this.listingInFlight - 1);
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
    await this.directoryLoad.run(targetSource, targetPath).catch(() => undefined);
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

  private async withMutation<T>(
    run: (location: { source: string; path: string }) => Promise<T>,
    options?: { expectListingReload?: boolean }
  ): Promise<T> {
    const location = this.assertCanMutate();
    runInAction(() => {
      this.beginMutation();
    });
    try {
      const result = await run(location);
      if (options?.expectListingReload) {
        runInAction(() => {
          this.markListingReloadPending();
        });
      }
      return result;
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
    const uploadId = createTransferId();
    const abortController = new AbortController();
    let wroteBytes = false;

    const rejectWithListError = (
      errorCode: FilesystemErrorCode,
      targetDirectory: string
    ): never => {
      this.uploads.set(uploadId, {
        fileName: file.name,
        loaded: 0,
        total: file.size,
        status: "error",
        error: errorCode,
        abortController,
        targetDirectory,
        source: this.currentSource,
      });
      throw new FilesystemError(errorCode);
    };

    try {
      const location = this.assertCanUpload();

      if (!isFileBrowserSafePathSegment(file.name)) {
        rejectWithListError("invalid-name", location.path);
      }

      let filePath: string;
      try {
        filePath = joinFileBrowserPathChild(location.path, file.name);
      } catch {
        rejectWithListError("invalid-name", location.path);
      }

      if (this.isUploadingPath(filePath, location.source)) {
        throw new FilesystemError("upload-already-in-progress");
      }
      if (this.isDownloadingPath(filePath, location.source)) {
        throw new FilesystemError("download-already-in-progress");
      }

      this.uploads.set(uploadId, {
        fileName: file.name,
        loaded: 0,
        total: file.size,
        status: "uploading",
        abortController,
        targetDirectory: location.path,
        source: location.source,
      });

      if (file.size <= UPLOAD_CHUNK_SIZE) {
        await apiFilesystemStore.createResource(location.source, filePath, {
          file,
          override,
          signal: abortController.signal,
          errorCode: "upload-chunk",
        });
        wroteBytes = true;
      } else {
        let lastProgressAt: number | null = null;
        try {
          await apiFilesystemStore.uploadFileChunked(location.source, filePath, {
            file,
            override,
            signal: abortController.signal,
            onProgress: (loaded) => {
              wroteBytes = loaded > 0;
              const now = Date.now();
              if (
                !shouldEmitUploadProgress({
                  loaded,
                  total: file.size,
                  lastEmittedAt: lastProgressAt,
                  now,
                })
              ) {
                return;
              }
              lastProgressAt = now;
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
        if (upload == null || upload.status === "error") {
          return;
        }
        upload.status = "done";
        upload.error = undefined;
        upload.appError = undefined;
        upload.loaded = upload.total;
        this.markListingReloadPending();
      });
    } catch (e: unknown) {
      const upload = this.uploads.get(uploadId);
      if (!upload || upload.status === "error" || upload.status === "done") {
        throw e;
      }
      if (upload.status === "cancelling") {
        runInAction(() => {
          upload.status = "error";
          upload.error = "upload-cancelled";
          upload.appError = undefined;
        });
        throw e;
      }
      const code = resolveFilesystemErrorCode(e, "upload-chunk");
      const appError = isFilesystemError(e) ? undefined : await normalizeApiError(e);
      runInAction(() => {
        const current = this.uploads.get(uploadId);
        if (!current || current.status === "error" || current.status === "done") {
          return;
        }
        current.status = "error";
        current.error = code;
        current.appError = appError;
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
    return this.reloadCurrentDirectory().finally(() => {
      runInAction(() => {
        this.pendingListingReloadCount = Math.max(0, this.pendingListingReloadCount - 1);
      });
    });
  };

  @action
  setUploadModalOpen(open: boolean): void {
    this.uploadModalOpen = open;
  }

  @action
  cancelUpload(uploadId: string): void {
    const upload = this.uploads.get(uploadId);
    if (upload == null || !isFileBrowserTransferCancellable(upload.status)) {
      return;
    }
    upload.abortController.abort();
    if (upload.status === "queued") {
      upload.status = "error";
      upload.error = "upload-cancelled";
      upload.appError = undefined;
      return;
    }
    upload.status = "cancelling";
  }

  @action
  clearFinishedUploads(): void {
    for (const [id, upload] of this.uploads) {
      if (isFileBrowserTransferInProgress(upload.status)) {
        continue;
      }
      this.uploads.delete(id);
    }
  }

  private hasActiveTransfer(
    transfers: Iterable<UploadProgress | DownloadProgress>,
    source: string,
    matchesPath: (transferPath: string) => boolean
  ): boolean {
    for (const transfer of transfers) {
      if (!isFileBrowserTransferInProgress(transfer.status) || transfer.source !== source) {
        continue;
      }
      const transferPath = toEntryPath(transfer.targetDirectory ?? "/", transfer.fileName);
      if (transferPath != null && matchesPath(transferPath)) {
        return true;
      }
    }
    return false;
  }

  isDownloadingPath(itemPath: string, source = this.currentSource): boolean {
    return this.hasActiveTransfer(this.downloads.values(), source, (path) => path === itemPath);
  }

  isUploadingPath(itemPath: string, source = this.currentSource): boolean {
    return this.hasActiveTransfer(this.uploads.values(), source, (path) => path === itemPath);
  }

  private assertNoActiveTransfers(itemPath: string, source: string): void {
    if (this.isUploadingPath(itemPath, source)) {
      throw new FilesystemError("upload-already-in-progress");
    }
    if (this.isDownloadingPath(itemPath, source)) {
      throw new FilesystemError("download-already-in-progress");
    }
    const isInsideItem = (path: string) => isNestedPath(path, itemPath);
    if (this.hasActiveTransfer(this.uploads.values(), source, isInsideItem)) {
      throw new FilesystemError("upload-in-directory-in-progress");
    }
    if (this.hasActiveTransfer(this.downloads.values(), source, isInsideItem)) {
      throw new FilesystemError("download-in-directory-in-progress");
    }
  }

  isTransferLockedPath(itemPath: string, source = this.currentSource): boolean {
    return this.isDownloadingPath(itemPath, source) || this.isUploadingPath(itemPath, source);
  }

  @action
  claimDownload(
    name: string,
    pinnedLocation: { source: string; directoryPath: string }
  ):
    | { ok: true; downloadId: string; abortController: AbortController }
    | { ok: false; error: FilesystemErrorCode } {
    if (!isFileBrowserSafePathSegment(name)) {
      return { ok: false, error: "invalid-name" };
    }

    let itemPath: string;
    try {
      itemPath = joinFileBrowserPathChild(pinnedLocation.directoryPath, name);
    } catch {
      return { ok: false, error: "invalid-name" };
    }

    if (this.isUploadingPath(itemPath, pinnedLocation.source)) {
      return { ok: false, error: "upload-already-in-progress" };
    }
    if (this.isDownloadingPath(itemPath, pinnedLocation.source)) {
      return { ok: false, error: "download-already-in-progress" };
    }

    const entry = this.files.find((file) => file.name === name);
    const downloadId = createTransferId();
    const abortController = new AbortController();
    this.downloads.set(
      downloadId,
      observable(
        {
          fileName: name,
          loaded: 0,
          total: entry?.size ?? 0,
          status: "queued" as const,
          abortController,
          targetDirectory: pinnedLocation.directoryPath,
          source: pinnedLocation.source,
        },
        { abortController: false }
      )
    );

    return { ok: true, downloadId, abortController };
  }

  @action
  abandonDownloadClaim(downloadId: string): void {
    const download = this.downloads.get(downloadId);
    if (download == null || download.status !== "queued") {
      return;
    }
    this.downloads.delete(downloadId);
  }

  @action
  finalizeUnstartedDownload(downloadId: string): void {
    const download = this.downloads.get(downloadId);
    if (download == null || download.status === "done" || download.status === "error") {
      return;
    }
    download.status = "error";
    download.error = "download-cancelled";
    download.appError = undefined;
  }

  @action
  cancelDownload(downloadId: string): void {
    const download = this.downloads.get(downloadId);
    if (download == null || !isFileBrowserTransferCancellable(download.status)) {
      return;
    }
    download.abortController.abort();
    if (download.status === "queued") {
      download.status = "error";
      download.error = "download-cancelled";
      download.appError = undefined;
      return;
    }
    download.status = "cancelling";
  }

  @action
  clearFinishedDownloads(): void {
    for (const [id, download] of this.downloads) {
      if (isFileBrowserTransferInProgress(download.status)) {
        continue;
      }
      this.downloads.delete(id);
    }
  }

  @action
  async renameItem(oldName: string, newName: string, kind: FileBrowserEntryKind): Promise<void> {
    await this.withMutation(
      async ({ source, path }) => {
        const oldPath = joinFileBrowserPathChild(path, oldName);
        this.assertNoActiveTransfers(oldPath, source);
        await apiFilesystemStore.renameResource(
          source,
          oldPath,
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
        const itemPath = joinFileBrowserPathChild(path, name);
        this.assertNoActiveTransfers(itemPath, source);
        await apiFilesystemStore.deleteResource(source, itemPath, kind);
      },
      { expectListingReload: true }
    );
  }

  @action
  setSelectedPaths(selectedPaths: SelectedPaths): void {
    this.selectedPaths = selectedPaths;
  }

  @action
  async deleteItems(paths: string[]): Promise<BulkDeleteFailedEntry[]> {
    return this.withMutation(
      async ({ source, path: directoryPath }) => {
        for (const itemPath of paths) {
          if (!isEntryInDirectory(itemPath, directoryPath)) {
            throw new FilesystemError("entry-not-in-current-directory");
          }
          this.assertNoActiveTransfers(itemPath, source);
        }

        const response = await apiFilesystemStore.deleteResources(source, paths);
        return pickBulkDeleteFailures(paths, response.failed);
      },
      { expectListingReload: true }
    );
  }

  private pruneSelectedPaths(): SelectedPaths {
    if (Object.keys(this.selectedPaths).length === 0) {
      return this.selectedPaths;
    }
    const existingPaths = new Set(
      this.files
        .map((file) => toEntryPath(this.currentPath, file.name))
        .filter((path): path is string => path != null)
    );
    return pickExistingSelectedPaths(this.selectedPaths, existingPaths);
  }

  async downloadItem(
    downloadId: string,
    name: string,
    browserFileTarget: BrowserFileDownloadTarget,
    pinnedLocation: { source: string; directoryPath: string }
  ): Promise<void> {
    const claimed = this.downloads.get(downloadId);
    if (claimed == null || claimed.status !== "queued") {
      await abortBrowserFileDownloadTarget(browserFileTarget);
      this.finalizeUnstartedDownload(downloadId);
      return;
    }

    runInAction(() => {
      claimed.status = "downloading";
    });

    let lastProgressAt: number | null = null;
    try {
      await apiFilesystemStore.downloadFile(
        pinnedLocation.source,
        joinFileBrowserPathChild(pinnedLocation.directoryPath, name),
        claimed.abortController.signal,
        browserFileTarget,
        {
          knownTotal: claimed.total,
          onProgress: (loaded, total) => {
            const now = Date.now();
            if (
              !shouldEmitUploadProgress({
                loaded,
                total,
                lastEmittedAt: lastProgressAt,
                now,
              })
            ) {
              return;
            }
            lastProgressAt = now;
            runInAction(() => {
              const download = this.downloads.get(downloadId);
              if (download == null || !isFileBrowserTransferInProgress(download.status)) {
                return;
              }
              download.loaded = loaded;
              if (total > 0) {
                download.total = total;
              }
              if (download.status !== "cancelling") {
                download.status = "downloading";
              }
            });
          },
        }
      );
      runInAction(() => {
        const download = this.downloads.get(downloadId);
        if (download == null || download.status === "error") {
          return;
        }
        download.status = "done";
        download.error = undefined;
        download.appError = undefined;
        if (download.total > 0) {
          download.loaded = download.total;
        }
      });
    } catch (error: unknown) {
      const download = this.downloads.get(downloadId);
      if (download == null || download.status === "error" || download.status === "done") {
        throw error;
      }
      if (download.status === "cancelling") {
        runInAction(() => {
          download.status = "error";
          download.error = "download-cancelled";
          download.appError = undefined;
        });
        throw error;
      }
      const code = resolveFilesystemErrorCode(error, "download-error");
      const appError = isFilesystemError(error) ? undefined : await normalizeApiError(error);
      runInAction(() => {
        const current = this.downloads.get(downloadId);
        if (current == null || current.status === "error" || current.status === "done") {
          return;
        }
        current.status = "error";
        current.error = code;
        current.appError = appError;
      });
      throw error;
    }
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
