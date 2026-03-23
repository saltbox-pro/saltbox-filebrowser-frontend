import { computed, makeObservable, observable } from "mobx";

import { FileInfo, SourceScope } from "saltbox-filesystem/shared/types";
import { appStore } from "./app-store";
import { envStore } from "./env-store";

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
    if (!response.ok) throw new Error(`Failed to fetch user: ${response.statusText}`);
    const data = await response.json();
    return data?.scopes || [];
  }

  async getResource(source: string, path: string): Promise<FileInfo | undefined> {
    if (!this.basePath) return undefined;
    const params = new URLSearchParams({ source, path });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`Failed to fetch resource: ${response.statusText}`);
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
    if (!response.ok) throw new Error(`Failed to create resource: ${response.statusText}`);
  }

  async deleteResource(source: string, path: string): Promise<void> {
    if (!this.basePath) return;
    const params = new URLSearchParams({ source, path });
    const response = await fetch(`${this.basePath}/api/resources?${params}`, {
      method: "DELETE",
      headers: this.authHeaders,
    });
    if (!response.ok) throw new Error(`Failed to delete resource: ${response.statusText}`);
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
    if (!response.ok) throw new Error(`Failed to fetch file content: ${response.statusText}`);
    return response.text();
  }

  async saveFileContent(source: string, filePath: string, content: string): Promise<void> {
    const fileName = filePath.split("/").pop() || "file";
    const blob = new Blob([content], { type: "text/plain" });
    const file = new File([blob], fileName, { type: "text/plain" });
    await this.createResource(source, filePath, { file, override: true });
  }

  downloadFile(source: string, filePath: string): void {
    const url = this.buildDownloadUrl(source, filePath);
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export const apiFilesystemStore = new ApiFilesystemStore("filebrowser");
