import {
  abortBrowserFileDownloadTarget,
  hasActiveFileBrowserTransfer,
  isFileBrowserTransferCancellable,
  isFileBrowserTransferInProgress,
  isGlobalServerError,
  isFileBrowserSafePathSegment,
  joinFileBrowserPathChild,
  shouldEmitUploadProgress,
  type BrowserFileDownloadTarget,
  type FileBrowserDownloadItem,
  type FileBrowserUploadItem,
} from "@saltbox/saltbox-frontend-common";
import { action, computed, makeObservable, observable, runInAction } from "mobx";

import { UPLOAD_CHUNK_SIZE } from "saltbox-filesystem/constants/upload";
import { createTransferId } from "saltbox-filesystem/helpers/create-transfer-id";
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
  @observable isLoading: boolean = false;
  @observable sourcesLoading: boolean = false;
  @observable error: FilesystemErrorCode | undefined;
  @observable uploads: Map<string, UploadProgress> = new Map();
  @observable downloads: Map<string, DownloadProgress> = new Map();
  @observable uploadModalOpen = false;
  @observable private mutationCount = 0;
  @observable private pendingListingReloadCount = 0;

  private loadId = 0;
  private listingInFlight = 0;
  private listingLoadChain: Promise<void> = Promise.resolve();

  constructor() {
    makeObservable(this);
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

  @action
  async loadSources(): Promise<boolean> {
    if (this.sources.length === 0) {
      this.sourcesLoading = true;
    }
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
        upload.loaded = upload.total;
        this.markListingReloadPending();
      });
    } catch (e: unknown) {
      runInAction(() => {
        const upload = this.uploads.get(uploadId);
        if (!upload || upload.status === "error" || upload.status === "done") {
          return;
        }
        if (upload.status === "cancelling") {
          upload.status = "error";
          upload.error = "upload-cancelled";
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

  isDownloadingPath(itemPath: string, source = this.currentSource): boolean {
    for (const download of this.downloads.values()) {
      if (!isFileBrowserTransferInProgress(download.status) || download.source !== source) {
        continue;
      }
      let downloadPath: string;
      try {
        downloadPath = joinFileBrowserPathChild(download.targetDirectory ?? "/", download.fileName);
      } catch {
        continue;
      }
      if (downloadPath === itemPath) {
        return true;
      }
    }
    return false;
  }

  isUploadingPath(itemPath: string, source = this.currentSource): boolean {
    for (const upload of this.uploads.values()) {
      if (!isFileBrowserTransferInProgress(upload.status) || upload.source !== source) {
        continue;
      }
      let uploadPath: string;
      try {
        uploadPath = joinFileBrowserPathChild(upload.targetDirectory ?? "/", upload.fileName);
      } catch {
        continue;
      }
      if (uploadPath === itemPath) {
        return true;
      }
    }
    return false;
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
        if (download.total > 0) {
          download.loaded = download.total;
        }
      });
    } catch (error: unknown) {
      runInAction(() => {
        const download = this.downloads.get(downloadId);
        if (download == null || download.status === "error" || download.status === "done") {
          return;
        }
        const cancelled = download.status === "cancelling";
        download.status = "error";
        if (cancelled) {
          download.error = "download-cancelled";
          return;
        }
        if (!isGlobalServerError(error)) {
          download.error = resolveFilesystemErrorCode(error, "download-error");
        }
      });
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
