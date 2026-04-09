import { computed, makeObservable, observable } from "mobx";
import i18n from "i18next";

import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";
import { appStore } from "./app-store";
import { envStore } from "./env-store";

const CHUNK_SIZE = 1 * 1024 * 1024; // 5 MB

export interface ChunkedUploadOptions {
  file: File;
  override?: boolean;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

class ApiFilesystemStore {
  @observable public serviceName: string;

  constructor(serviceName: string) {
    makeObservable(this);
    this.serviceName = serviceName;
  }

  @computed get env() {
    return envStore?.services?.get(this.serviceName);
  }

  private get basePath() {
    return this.env?.api_base_path || "";
  }

  private get authHeaders(): Record<string, string> {
    const token = appStore.authStore?.user?.access_token;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  async getScopes(): Promise<SourceScope[]> {
    if (!this.basePath) return [];
    const params = new URLSearchParams({ id: "self" });
    const response = await fetch(`${this.basePath}/public/api/users?${params}`, {
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.fetchUser")}: ${response.statusText}`);
    const data = await response.json();
    return data?.scopes || [];
  }

  async getResource(source: string, path: string): Promise<FileInfo | undefined> {
    if (!this.basePath) return undefined;
    const params = new URLSearchParams({ source, path });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.fetchResource")}: ${response.statusText}`);
    return response.json();
  }

  async createResource(
    source: string,
    path: string,
    options?: { isDir?: boolean; file?: File; override?: boolean },
  ): Promise<void> {
    if (!this.basePath) return;
    const params = new URLSearchParams({ source, path });
    if (options?.isDir) params.set("isDir", "true");
    if (options?.override) params.set("override", "true");

    const headers: Record<string, string> = { ...this.authHeaders };
    let body: BodyInit | undefined;

    if (options?.file) {
      body = options.file;
      headers["Content-Type"] = options.file.type || "application/octet-stream";
    }

    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.createResource")}: ${response.statusText}`);
  }

  async uploadFileChunked(
    source: string,
    path: string,
    options: ChunkedUploadOptions,
  ): Promise<void> {
    if (!this.basePath) return;

    const { file, override, onProgress, signal } = options;
    const totalSize = file.size;
    const params = new URLSearchParams({ source, path });
    if (override) params.set("override", "true");
    const url = `${this.basePath}/api/resources?${params}`;

    let offset = 0;
    while (offset < totalSize) {
      if (signal?.aborted) {
        throw new DOMException(i18n.t("errors.uploadCancelled"), "AbortError");
      }

      const end = Math.min(offset + CHUNK_SIZE, totalSize);
      const chunk = file.slice(offset, end);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...this.authHeaders,
          "Content-Type": file.type || "application/octet-stream",
          "X-File-Chunk-Offset": String(offset),
          "X-File-Total-Size": String(totalSize),
        },
        body: chunk,
        signal,
      });

      if (!response.ok) {
        throw new Error(`${i18n.t("errors.uploadChunk")}: ${response.statusText}`);
      }

      offset = end;
      onProgress?.(offset, totalSize);
    }
  }

  async deleteResource(source: string, path: string): Promise<void> {
    if (!this.basePath) return;
    const params = new URLSearchParams({ source, path });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      method: "DELETE",
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.deleteResource")}: ${response.statusText}`);
  }

  buildDownloadUrl(source: string, file: string): string {
    const params = new URLSearchParams();
    params.append("files", `${source}::/${file}`);
    return `${this.basePath}/api/raw?${params}`;
  }

  async getFileContent(source: string, filePath: string): Promise<string> {
    const url = this.buildDownloadUrl(source, filePath);
    const response = await fetch(url, {
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.fetchFileContent")}: ${response.statusText}`);
    return response.text();
  }

  async saveFileContent(source: string, filePath: string, content: string): Promise<void> {
    const fileName = filePath.split("/").pop() || "file";
    const blob = new Blob([content], { type: "text/plain" });
    const file = new File([blob], fileName, { type: "text/plain" });
    await this.createResource(source, filePath, { file, override: true });
  }

  async renameResource(source: string, fromPath: string, toPath: string): Promise<void> {
    if (!this.basePath) return;
    const params = new URLSearchParams({
      action: "rename",
      from: `${source}::${fromPath}`,
      destination: `${source}::${toPath}`,
    });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      method: "PATCH",
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.renameResource")}: ${response.statusText}`);
  }

  async downloadFile(source: string, filePath: string, signal?: AbortSignal): Promise<void> {
    const url = this.buildDownloadUrl(source, filePath);
    const response = await fetch(url, {
      headers: this.authHeaders,
      signal,
    });
    if (!response.ok) throw new Error(`${i18n.t("errors.downloadFile")}: ${response.statusText}`);

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const fileName = filePath.split("/").pop() || "download";

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
}

export const apiFilesystemStore = new ApiFilesystemStore("filebrowser");
