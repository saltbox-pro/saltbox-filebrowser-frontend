import { action, computed, makeObservable, observable, runInAction } from "mobx";
import i18n from "i18next";

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

  constructor() {
    makeObservable(this);
  }

  @computed get hasActiveUploads(): boolean {
    return Array.from(this.uploads.values()).some((u) => u.status === "uploading");
  }

  @action
  async loadSources(): Promise<void> {
    this.sourcesLoading = true;
    try {
      const scopes = await apiFilesystemStore.getScopes();
      runInAction(() => {
        this.sources = scopes;
        if (scopes.length > 0 && !this.currentSource) {
          this.currentSource = scopes[0].name;
        }
        this.sourcesLoading = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message;
        this.sourcesLoading = false;
      });
    }
  }

  @action
  async loadDirectory(source?: string, path?: string): Promise<void> {
    const targetSource = source ?? this.currentSource;
    const targetPath = path ?? this.currentPath;

    this.isLoading = true;
    this.error = undefined;

    try {
      const data = await apiFilesystemStore.getResource(targetSource, targetPath);
      runInAction(() => {
        this.currentSource = targetSource;
        this.currentPath = targetPath;
        this.files = this.mapToEntries(data);
        this.isLoading = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e instanceof TypeError ? i18n.t("errors.networkError") : e.message;
        this.isLoading = false;
      });
    }
  }

  @action
  async createFolder(name: string): Promise<void> {
    const folderPath = this.currentPath === "/"
      ? `/${name}`
      : `${this.currentPath}/${name}`;

    await apiFilesystemStore.createResource(this.currentSource, folderPath, { isDir: true });
    await this.loadDirectory();
  }

  @action
  async createFile(name: string): Promise<void> {
    const filePath = this.currentPath === "/"
      ? `/${name}`
      : `${this.currentPath}/${name}`;

    const emptyFile = new File([""], name, { type: "text/plain" });
    await apiFilesystemStore.createResource(this.currentSource, filePath, { file: emptyFile });
    await this.loadDirectory();
  }

  @action
  async uploadFile(file: File, override?: boolean): Promise<void> {
    const filePath = this.currentPath === "/"
      ? `/${file.name}`
      : `${this.currentPath}/${file.name}`;

    const uploadId = `${file.name}-${Date.now()}`;
    const abortController = new AbortController();

    runInAction(() => {
      this.uploads.set(uploadId, {
        fileName: file.name,
        loaded: 0,
        total: file.size,
        status: "uploading",
        abortController,
      });
    });

    try {
      if (file.size <= CHUNK_THRESHOLD) {
        await apiFilesystemStore.createResource(this.currentSource, filePath, { file, override });
      } else {
        await apiFilesystemStore.uploadFileChunked(this.currentSource, filePath, {
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
      await this.loadDirectory();
    } catch (e: any) {
      runInAction(() => {
        const upload = this.uploads.get(uploadId);
        if (upload) {
          upload.status = "error";
          upload.error = e.name === "AbortError"
            ? i18n.t("upload.cancelled")
            : e instanceof TypeError
              ? i18n.t("errors.networkError")
              : e.message;
        }
      });
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
    const fromPath = this.currentPath === "/"
      ? `/${oldName}`
      : `${this.currentPath}/${oldName}`;
    const toPath = this.currentPath === "/"
      ? `/${newName}`
      : `${this.currentPath}/${newName}`;

    await apiFilesystemStore.renameResource(this.currentSource, fromPath, toPath);
    await this.loadDirectory();
  }

  @action
  async deleteItem(name: string): Promise<void> {
    const itemPath = this.currentPath === "/"
      ? `/${name}`
      : `${this.currentPath}/${name}`;

    await apiFilesystemStore.deleteResource(this.currentSource, itemPath);
    await this.loadDirectory();
  }

  async downloadItem(name: string, signal?: AbortSignal): Promise<void> {
    const itemPath = this.currentPath === "/"
      ? `/${name}`
      : `${this.currentPath}/${name}`;

    await apiFilesystemStore.downloadFile(this.currentSource, itemPath, signal);
  }

  private mapToEntries(data: FileInfo | undefined): FileEntry[] {
    if (!data) return [];
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
