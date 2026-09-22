import {
  type AppError,
  createLoader,
  type Loader,
  getMonacoLanguage,
} from "@saltbox/saltbox-frontend-common";
import { action, computed, makeObservable, observable, runInAction } from "mobx";

import { apiFilesystemStore } from "./api-filesystem-store";

export type FileEditorMode = "view" | "edit";

class FileEditorStore {
  @observable source: string = "";
  @observable filePath: string = "";
  @observable fileName: string = "";
  @observable mode: FileEditorMode = "view";
  @observable originalContent: string = "";
  @observable currentContent: string = "";
  @observable isSaving: boolean = false;
  @observable saveError: AppError | null = null;
  readonly fileLoad: Loader<[string, string], string>;

  private saveId = 0;

  constructor() {
    makeObservable(this);
    this.fileLoad = createLoader({
      run: (source: string, filePath: string) =>
        apiFilesystemStore.getFileContent(source, filePath),
      onSuccess: (content, source, filePath) => {
        if (this.source !== source || this.filePath !== filePath) {
          return;
        }
        this.originalContent = content;
        this.currentContent = content;
      },
    });
  }

  @computed get isLoading(): boolean {
    return this.fileLoad.isLoading;
  }

  @computed get hasLoadError(): boolean {
    return this.fileLoad.error != null;
  }

  @computed get isDirty(): boolean {
    return this.originalContent !== this.currentContent;
  }

  @computed get language(): string {
    return getMonacoLanguage(this.fileName);
  }

  @action
  loadFile(source: string, filePath: string): void {
    if (this.isSaving) {
      return;
    }
    this.saveId += 1;

    this.source = source;
    this.filePath = filePath;
    this.fileName = filePath.split("/").pop() || "";
    this.mode = "view";
    this.isSaving = false;
    this.saveError = null;
    this.originalContent = "";
    this.currentContent = "";
    this.fileLoad.resetInitial();

    this.fileLoad.run(source, filePath).catch(() => undefined);
  }

  @action
  enterEdit = (): void => {
    if (this.mode === "edit" || this.isLoading || this.isSaving || this.hasLoadError) {
      return;
    }
    this.mode = "edit";
    this.currentContent = this.originalContent;
    this.saveError = null;
  };

  @action
  cancelEdit = (): void => {
    if (this.isSaving) {
      return;
    }
    this.mode = "view";
    this.currentContent = this.originalContent;
    this.saveError = null;
  };

  @action
  updateContent(content: string): void {
    if (this.mode !== "edit" || this.hasLoadError || this.isLoading || this.isSaving) {
      return;
    }
    this.currentContent = content;
  }

  @action
  clearSaveError = (): void => {
    this.saveError = null;
  };

  @action
  setSaveError = (error: AppError | null): void => {
    this.saveError = error;
  };

  @action
  async saveFile(): Promise<boolean> {
    if (this.mode !== "edit" || this.hasLoadError || this.isLoading || this.isSaving) {
      return false;
    }

    const saveId = ++this.saveId;
    const source = this.source;
    const filePath = this.filePath;
    const content = this.currentContent;

    this.isSaving = true;
    this.saveError = null;

    try {
      await apiFilesystemStore.saveFileContent(source, filePath, content);
      runInAction(() => {
        if (saveId !== this.saveId) {
          return;
        }
        this.originalContent = content;
        this.currentContent = content;
        this.mode = "view";
        this.isSaving = false;
      });
      if (saveId !== this.saveId) {
        throw new DOMException("Aborted", "AbortError");
      }
      return true;
    } catch (e: unknown) {
      runInAction(() => {
        if (saveId === this.saveId) {
          this.isSaving = false;
        }
      });
      throw e;
    }
  }

  @action
  reset(): void {
    this.saveId += 1;
    this.source = "";
    this.filePath = "";
    this.fileName = "";
    this.mode = "view";
    this.originalContent = "";
    this.currentContent = "";
    this.isSaving = false;
    this.saveError = null;
    this.fileLoad.resetInitial();
  }
}

export const fileEditorStore = new FileEditorStore();
