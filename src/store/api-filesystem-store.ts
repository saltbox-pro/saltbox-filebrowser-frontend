import {
  abortBrowserFileDownloadTarget,
  BrowserFileDownloadAbortError,
  BrowserFileDownloadIncompleteError,
  BrowserFileDownloadTooLargeError,
  writeResponseToBrowserFile,
  type BrowserFileDownloadTarget,
} from "@saltbox/saltbox-frontend-common";
import { computed, makeObservable, observable } from "mobx";

import { UPLOAD_CHUNK_SIZE } from "saltbox-filesystem/constants/upload";
import {
  FilesystemError,
  CREATE_ERROR_CODE,
  REMOVE_ERROR_CODE,
  RENAME_ERROR_CODE,
  type FileBrowserEntryKind,
  type FilesystemErrorCode,
} from "saltbox-filesystem/helpers/filesystem-error";
import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";

import { appStore } from "./app-store";
import { envStore } from "./env-store";

export interface ChunkedUploadOptions {
  file: File;
  override?: boolean;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

function throwResponseError(response: Response): never {
  const error = new Error("Response returned an error code");
  error.name = "ResponseError";
  (error as Error & { response: Response }).response = response;
  throw error;
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
    if (!this.basePath) {
      throw new FilesystemError("fetch-user");
    }
    const params = new URLSearchParams({ id: "self" });
    const response = await fetch(`${this.basePath}/public/api/users?${params}`, {
      headers: this.authHeaders,
    });
    if (!response.ok) throwResponseError(response);
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
    if (!response.ok) throwResponseError(response);
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
      throwResponseError(response);
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

      const end = Math.min(offset + UPLOAD_CHUNK_SIZE, totalSize);
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
        throwResponseError(response);
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
      throwResponseError(response);
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
    if (!response.ok) throwResponseError(response);
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
      throwResponseError(response);
    }
  }

  async downloadFile(
    source: string,
    filePath: string,
    signal?: AbortSignal,
    browserFileTarget?: BrowserFileDownloadTarget,
    options?: {
      knownTotal?: number;
      onProgress?: (loaded: number, total: number) => void;
    }
  ): Promise<void> {
    const target = browserFileTarget ?? { mode: "blob" as const };

    try {
      if (!this.basePath) {
        throw new FilesystemError("download-error");
      }
      const url = this.buildDownloadUrl(source, filePath);
      const response = await fetch(url, {
        headers: this.authHeaders,
        signal,
      });
      if (!response.ok) throwResponseError(response);

      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const fileName = filePath.split("/").pop() || "download";
      await writeResponseToBrowserFile({
        response,
        fileName,
        target,
        signal,
        knownTotal: options?.knownTotal,
        onProgress: options?.onProgress,
      });
    } catch (error) {
      await abortBrowserFileDownloadTarget(target);
      if (error instanceof BrowserFileDownloadAbortError || signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (error instanceof BrowserFileDownloadIncompleteError) {
        throw new FilesystemError("download-error");
      }
      if (error instanceof BrowserFileDownloadTooLargeError) {
        throw new FilesystemError("file-too-large-to-download");
      }
      throw error;
    }
  }
}

export const apiFilesystemStore = new ApiFilesystemStore("filebrowser");
