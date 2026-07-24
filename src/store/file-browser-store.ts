import { isGlobalServerError, joinPathChild } from "@saltbox/saltbox-frontend-common";
import i18n from "i18next";
import { action, computed, makeObservable, observable, runInAction } from "mobx";

import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";

import { apiFilesystemStore } from "./api-filesystem-store";

const CHUNK_THRESHOLD = 5 * 1024 * 1024; // 5 MB

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
  error?: string;
  abortController: AbortController;
}

class FileBrowserStore {
  @observable currentPath: string = "/";
  @observable currentSource: string = "";
  @observable sources: SourceScope[] = [];
  @observable files: FileEntry[] = [];
  @observable isLoading: boolean = false;
  @observable sourcesLoading: boolean = false;
  @observable error: string | undefined;
  @observable uploads: Map<string, UploadProgress> = new Map();
  @observable private mutationCount = 0;

  private loadId = 0;
  private pendingDirectoryReload = false;

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
    return this.isLoading || this.isMutating || this.hasActiveUploads;
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
          this.error = e instanceof Error ? e.message : String(e);
        }
      });
      return false;
    }
  }

  @action
  async loadDirectory(source?: string, path?: string): Promise<void> {
    const targetSource = source ?? this.currentSource;
    const targetPath = path ?? this.currentPath;
    if (!targetSource) {
      return;
    }

    const loadId = ++this.loadId;
    this.isLoading = true;
    this.error = undefined;

    try {
      const data = await apiFilesystemStore.getResource(targetSource, targetPath);
      runInAction(() => {
        if (loadId !== this.loadId) {
          return;
        }
        this.currentSource = targetSource;
        this.currentPath = targetPath;
        this.files = this.mapToEntries(data);
        this.isLoading = false;
      });
    } catch (e: unknown) {
      runInAction(() => {
        if (loadId !== this.loadId) {
          return;
        }
        this.isLoading = false;
        if (isGlobalServerError(e)) {
          return;
        }
        this.error =
          e instanceof TypeError
            ? i18n.t("errors.networkError")
            : e instanceof Error
              ? e.message
              : String(e);
      });
    }
  }

  private assertSourceLocation(): { source: string; path: string } {
    if (!this.currentSource) {
      throw new Error(i18n.t("errors.noSource"));
    }
    return { source: this.currentSource, path: this.currentPath };
  }

  private assertCanMutate(): { source: string; path: string } {
    if (this.isBusy) {
      throw new Error(i18n.t("errors.operationBusy"));
    }
    return this.assertSourceLocation();
  }

  private assertCanUpload(): { source: string; path: string } {
    if (this.isLoading || this.isMutating) {
      throw new Error(i18n.t("errors.operationBusy"));
    }
    return this.assertSourceLocation();
  }

  private beginMutation = () => {
    this.mutationCount += 1;
  };

  private endMutation = () => {
    this.mutationCount = Math.max(0, this.mutationCount - 1);
  };

  private async withMutation(run: (location: { source: string; path: string }) => Promise<void>) {
    const location = this.assertCanMutate();
    runInAction(() => {
      this.beginMutation();
    });
    try {
      await run(location);
    } finally {
      runInAction(() => {
        this.endMutation();
      });
    }
  }

  private async reloadCurrentDirectory(): Promise<void> {
    if (this.isLoading) {
      this.pendingDirectoryReload = true;
      return;
    }

    do {
      this.pendingDirectoryReload = false;
      await this.loadDirectory(this.currentSource, this.currentPath);
    } while (this.pendingDirectoryReload);
  }

  @action
  async createFolder(name: string): Promise<void> {
    await this.withMutation(async ({ source, path }) => {
      await apiFilesystemStore.createResource(source, joinPathChild(path, name), {
        isDir: true,
      });
      await this.reloadCurrentDirectory();
    });
  }

  @action
  async createFile(name: string): Promise<void> {
    await this.withMutation(async ({ source, path }) => {
      const emptyFile = new File([""], name, { type: "text/plain" });
      await apiFilesystemStore.createResource(source, joinPathChild(path, name), {
        file: emptyFile,
      });
      await this.reloadCurrentDirectory();
    });
  }

  @action
  async uploadFile(file: File, override?: boolean): Promise<void> {
    const uploadId = `${file.name}-${Date.now()}`;
    const abortController = new AbortController();

    try {
      const location = this.assertCanUpload();
      const filePath = joinPathChild(location.path, file.name);

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
        });
      } else {
        await apiFilesystemStore.uploadFileChunked(location.source, filePath, {
          file,
          override,
          signal: abortController.signal,
          onProgress: (loaded) => {
            runInAction(() => {
              const upload = this.uploads.get(uploadId);
              if (upload) {
                upload.loaded = loaded;
              }
            });
          },
        });
      }
      runInAction(() => {
        const upload = this.uploads.get(uploadId);
        if (upload) {
          upload.status = "done";
          upload.loaded = upload.total;
        }
      });
      await this.reloadCurrentDirectory();
    } catch (e: unknown) {
      runInAction(() => {
        const message =
          e instanceof Error && e.name === "AbortError"
            ? i18n.t("upload.cancelled")
            : e instanceof TypeError
              ? i18n.t("errors.networkError")
              : e instanceof Error
                ? e.message
                : String(e);

        const upload = this.uploads.get(uploadId);
        if (upload) {
          upload.status = "error";
          upload.error = message;
          return;
        }

        this.uploads.set(uploadId, {
          fileName: file.name,
          loaded: 0,
          total: file.size,
          status: "error",
          error: message,
          abortController,
        });
      });
      throw e;
    }
  }

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
  async renameItem(oldName: string, newName: string): Promise<void> {
    await this.withMutation(async ({ source, path }) => {
      await apiFilesystemStore.renameResource(
        source,
        joinPathChild(path, oldName),
        joinPathChild(path, newName)
      );
      await this.reloadCurrentDirectory();
    });
  }

  @action
  async deleteItem(name: string): Promise<void> {
    await this.withMutation(async ({ source, path }) => {
      await apiFilesystemStore.deleteResource(source, joinPathChild(path, name));
      await this.reloadCurrentDirectory();
    });
  }

  async downloadItem(name: string, signal?: AbortSignal): Promise<void> {
    await this.withMutation(async ({ source, path }) => {
      await apiFilesystemStore.downloadFile(source, joinPathChild(path, name), signal);
    });
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
