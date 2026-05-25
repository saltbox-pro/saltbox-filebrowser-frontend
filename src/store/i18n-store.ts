import { setDateTimeLocale, AppLanguage } from "@saltbox/saltbox-frontend-common";
import { makeAutoObservable } from "mobx";

class I18NStore {
  readonly supportedLanguages: Array<AppLanguage> = [AppLanguage.EN, AppLanguage.RU];
  currentLanguage: AppLanguage = AppLanguage.EN;

  constructor() {
    makeAutoObservable(this);

    const stored = localStorage.getItem("i18nextLng");
    if (stored && this.supportedLanguages.includes(stored as AppLanguage)) {
      this.currentLanguage = stored as AppLanguage;
    }

    setDateTimeLocale(this.currentLanguage);
  }

  setLanguage(language: AppLanguage) {
    this.currentLanguage = language;
    setDateTimeLocale(language);
  }
}

export const i18nStore = new I18NStore();
