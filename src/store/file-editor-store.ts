import { action, computed, makeObservable, observable, runInAction } from "mobx";

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
  @observable error: string | undefined;
  @observable saveError: string | undefined;

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
    this.source = source;
    this.filePath = filePath;
    this.fileName = filePath.split("/").pop() || "";
    this.isLoading = true;
    this.error = undefined;
    this.saveError = undefined;

    try {
      const content = await apiFilesystemStore.getFileContent(source, filePath);
      runInAction(() => {
        this.originalContent = content;
        this.currentContent = content;
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
  updateContent(content: string): void {
    this.currentContent = content;
  }

  @action
  async saveFile(): Promise<void> {
    this.isSaving = true;
    this.saveError = undefined;

    try {
      await apiFilesystemStore.saveFileContent(this.source, this.filePath, this.currentContent);
      runInAction(() => {
        this.originalContent = this.currentContent;
        this.isSaving = false;
      });
    } catch (e: any) {
      runInAction(() => {
        this.saveError = e.message;
        this.isSaving = false;
      });
    }
  }

  @action
  reset(): void {
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
