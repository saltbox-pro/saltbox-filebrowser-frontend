import { action, makeObservable, observable, runInAction } from "mobx";

import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";
import { apiFilesystemStore } from "./api-filesystem-store";

export interface FileEntry {
  name: string;
  size: number;
  modified: string;
  type: string;
  isDirectory: boolean;
}

class FileBrowserStore {
  @observable currentPath: string = "/";
  @observable currentSource: string = "";
  @observable sources: SourceScope[] = [];
  @observable files: FileEntry[] = [];
  @observable isLoading: boolean = false;
  @observable sourcesLoading: boolean = false;
  @observable error: string | undefined;

  constructor() {
    makeObservable(this);
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
    if (source) this.currentSource = source;
    if (path !== undefined) this.currentPath = path;

    this.isLoading = true;
    this.error = undefined;

    try {
      const data = await apiFilesystemStore.getResource(this.currentSource, this.currentPath);
      runInAction(() => {
        this.files = this.mapToEntries(data);
        this.isLoading = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message;
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
  async uploadFile(file: File, override?: boolean): Promise<void> {
    const filePath = this.currentPath === "/"
      ? `/${file.name}`
      : `${this.currentPath}/${file.name}`;

    await apiFilesystemStore.createResource(this.currentSource, filePath, { file, override });
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

  downloadItem(name: string): void {
    const itemPath = this.currentPath === "/"
      ? `/${name}`
      : `${this.currentPath}/${name}`;

    apiFilesystemStore.downloadFile(this.currentSource, itemPath);
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
