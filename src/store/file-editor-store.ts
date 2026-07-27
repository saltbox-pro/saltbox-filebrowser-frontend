import { isGlobalServerError } from "@saltbox/saltbox-frontend-common";
import { action, computed, makeObservable, observable, runInAction } from "mobx";

import {
  resolveFilesystemErrorCode,
  type FilesystemErrorCode,
} from "saltbox-filesystem/helpers/filesystem-error";
import { getMonacoLanguage } from "saltbox-filesystem/shared/language-utils";

import { apiFilesystemStore } from "./api-filesystem-store";

class FileEditorStore {
  @observable source: string = "";
  @observable filePath: string = "";
  @observable fileName: string = "";
  @observable originalContent: string = "";
  @observable currentContent: string = "";
  @observable isLoading: boolean = false;
  @observable isSaving: boolean = false;
  @observable error: FilesystemErrorCode | undefined;
  @observable saveError: FilesystemErrorCode | undefined;

  private loadId = 0;
  private saveId = 0;

  constructor() {
    makeObservable(this);
  }

  @computed get isDirty(): boolean {
    return this.originalContent !== this.currentContent;
  }

  @computed get language(): string {
    return getMonacoLanguage(this.fileName);
  }

  @action
  async loadFile(source: string, filePath: string): Promise<void> {
    if (this.isSaving) {
      return;
    }
    const loadId = ++this.loadId;
    this.saveId += 1;

    this.source = source;
    this.filePath = filePath;
    this.fileName = filePath.split("/").pop() || "";
    this.isLoading = true;
    this.isSaving = false;
    this.error = undefined;
    this.saveError = undefined;
    this.originalContent = "";
    this.currentContent = "";

    try {
      const content = await apiFilesystemStore.getFileContent(source, filePath);
      runInAction(() => {
        if (loadId !== this.loadId) {
          return;
        }
        this.originalContent = content;
        this.currentContent = content;
        this.isLoading = false;
      });
    } catch (e: unknown) {
      runInAction(() => {
        if (loadId !== this.loadId) {
          return;
        }
        this.isLoading = false;
        this.originalContent = "";
        this.currentContent = "";
        this.error = resolveFilesystemErrorCode(e, "fetch-file-content");
      });
    }
  }

  @action
  updateContent(content: string): void {
    if (this.error != null || this.isLoading || this.isSaving) {
      return;
    }
    this.currentContent = content;
  }

  @action
  async saveFile(): Promise<boolean> {
    if (this.error != null || this.isLoading || this.isSaving) {
      return false;
    }

    const saveId = ++this.saveId;
    const source = this.source;
    const filePath = this.filePath;
    const content = this.currentContent;

    this.isSaving = true;
    this.saveError = undefined;

    try {
      await apiFilesystemStore.saveFileContent(source, filePath, content);
      runInAction(() => {
        if (saveId !== this.saveId) {
          return;
        }
        this.originalContent = content;
        this.isSaving = false;
      });
      return saveId === this.saveId;
    } catch (e: unknown) {
      runInAction(() => {
        if (saveId !== this.saveId) {
          return;
        }
        this.isSaving = false;
        if (isGlobalServerError(e)) {
          return;
        }
        this.saveError = resolveFilesystemErrorCode(e, "save-file-error");
      });
      return false;
    }
  }

  @action
  reset(): void {
    if (this.isSaving) {
      return;
    }
    this.loadId += 1;
    this.saveId += 1;
    this.source = "";
    this.filePath = "";
    this.fileName = "";
    this.originalContent = "";
    this.currentContent = "";
    this.isLoading = false;
    this.isSaving = false;
    this.error = undefined;
    this.saveError = undefined;
  }
}

export const fileEditorStore = new FileEditorStore();
