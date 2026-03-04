class AppStore {
  authStore: any;
  pluginsStore: any;

  constructor() {
    this.authStore = null;
    this.pluginsStore = null;
  }

  init(authStore: any, pluginsStore: any) {
    this.authStore = authStore;
    this.pluginsStore = pluginsStore;
  }
}

export const appStore = new AppStore();
