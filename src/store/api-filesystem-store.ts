import { computed, makeObservable, observable } from "mobx";

import {
  FilesystemError,
  CREATE_ERROR_CODE,
  NAME_ALREADY_EXISTS_CODE,
  REMOVE_ERROR_CODE,
  RENAME_ERROR_CODE,
  type FileBrowserEntryKind,
  type FilesystemErrorCode,
} from "saltbox-filesystem/helpers/filesystem-error";
import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";

import { appStore } from "./app-store";
import { envStore } from "./env-store";

const CHUNK_SIZE = 5 * 1024 * 1024;

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

  private throwResponseError(
    response: Response,
    fallback: FilesystemErrorCode,
    conflict?: FilesystemErrorCode
  ): never {
    const code: FilesystemErrorCode =
      response.status === 409
        ? (conflict ?? fallback)
        : response.status === 503
          ? "service-unavailable"
          : response.status >= 500 && response.status < 600
            ? "server-error"
            : fallback;

    throw new FilesystemError(code);
  }

  async getScopes(): Promise<SourceScope[]> {
    if (!this.basePath) {
      throw new FilesystemError("fetch-user");
    }
    const params = new URLSearchParams({ id: "self" });
    const response = await fetch(`${this.basePath}/public/api/users?${params}`, {
      headers: this.authHeaders,
    });
    if (!response.ok) this.throwResponseError(response, "fetch-user");
    const data = await response.json();
    return data?.scopes || [];
  }

  async getResource(source: string, path: string): Promise<FileInfo | undefined> {
    if (!this.basePath) {
      throw new FilesystemError("fetch-resource");
    }
    const params = new URLSearchParams({ source, path });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      headers: this.authHeaders,
    });
    if (!response.ok) this.throwResponseError(response, "fetch-resource");
    return response.json();
  }

  async createResource(
    source: string,
    path: string,
    options?: {
      isDir?: boolean;
      file?: File;
      override?: boolean;
      signal?: AbortSignal;
      errorCode?: FilesystemErrorCode;
    }
  ): Promise<void> {
    if (!this.basePath) {
      throw new FilesystemError(options?.errorCode ?? CREATE_ERROR_CODE);
    }
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
      signal: options?.signal,
    });
    if (!response.ok) {
      this.throwResponseError(
        response,
        options?.errorCode ?? CREATE_ERROR_CODE,
        options?.override ? undefined : NAME_ALREADY_EXISTS_CODE
      );
    }
  }

  async uploadFileChunked(
    source: string,
    path: string,
    options: ChunkedUploadOptions
  ): Promise<void> {
    if (!this.basePath) {
      throw new FilesystemError("upload-chunk");
    }

    const { file, override, onProgress, signal } = options;
    const totalSize = file.size;
    const params = new URLSearchParams({ source, path });
    if (override) params.set("override", "true");
    const url = `${this.basePath}/api/resources?${params}`;

    let offset = 0;
    while (offset < totalSize) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
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
        this.throwResponseError(
          response,
          "upload-chunk",
          override ? undefined : NAME_ALREADY_EXISTS_CODE
        );
      }

      offset = end;
      onProgress?.(offset, totalSize);
    }
  }

  async deleteResource(source: string, path: string, _kind: FileBrowserEntryKind): Promise<void> {
    if (!this.basePath) {
      throw new FilesystemError(REMOVE_ERROR_CODE);
    }
    const params = new URLSearchParams({ source, path });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      method: "DELETE",
      headers: this.authHeaders,
    });
    if (!response.ok) {
      this.throwResponseError(response, REMOVE_ERROR_CODE);
    }
  }

  buildDownloadUrl(source: string, file: string): string {
    const normalized = file.replace(/^\/+/, "");
    const params = new URLSearchParams();
    params.append("files", `${source}::/${normalized}`);
    return `${this.basePath}/api/raw?${params}`;
  }

  async getFileContent(source: string, filePath: string): Promise<string> {
    if (!this.basePath) {
      throw new FilesystemError("fetch-file-content");
    }
    const url = this.buildDownloadUrl(source, filePath);
    const response = await fetch(url, {
      headers: this.authHeaders,
    });
    if (!response.ok) this.throwResponseError(response, "fetch-file-content");
    return response.text();
  }

  async saveFileContent(source: string, filePath: string, content: string): Promise<void> {
    if (!this.basePath) {
      throw new FilesystemError("file-write-error");
    }
    const fileName = filePath.split("/").pop() || "file";
    const blob = new Blob([content], { type: "text/plain" });
    const file = new File([blob], fileName, { type: "text/plain" });
    await this.createResource(source, filePath, {
      file,
      override: true,
      errorCode: "file-write-error",
    });
  }

  async renameResource(
    source: string,
    fromPath: string,
    toPath: string,
    _kind: FileBrowserEntryKind
  ): Promise<void> {
    if (!this.basePath) {
      throw new FilesystemError(RENAME_ERROR_CODE);
    }
    const params = new URLSearchParams({
      action: "rename",
      from: `${source}::${fromPath}`,
      destination: `${source}::${toPath}`,
    });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      method: "PATCH",
      headers: this.authHeaders,
    });
    if (!response.ok) {
      this.throwResponseError(response, RENAME_ERROR_CODE, NAME_ALREADY_EXISTS_CODE);
    }
  }

  async downloadFile(source: string, filePath: string, signal?: AbortSignal): Promise<void> {
    if (!this.basePath) {
      throw new FilesystemError("download-error");
    }
    const url = this.buildDownloadUrl(source, filePath);
    const response = await fetch(url, {
      headers: this.authHeaders,
      signal,
    });
    if (!response.ok) this.throwResponseError(response, "download-error");

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const blob = await response.blob();
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const blobUrl = URL.createObjectURL(blob);
    const fileName = filePath.split("/").pop() || "download";

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 60_000);
  }
}

export const apiFilesystemStore = new ApiFilesystemStore("filebrowser");
