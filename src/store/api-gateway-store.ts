import { Configuration, UserSettingsApi } from "@saltbox/saltbox-gateway-api-client";
import { computed, makeObservable, observable } from "mobx";

import { appStore } from "./app-store";
import { envStore } from "./env-store";

class ApiGatewayStore {
  @observable public serviceName: string;

  private get apiConfig() {
    if (!this.env || !appStore.authStore?.user?.access_token) {
      return undefined;
    }
    return new Configuration({
      basePath: this.env?.api_base_path,
      headers: {
        Authorization: `Bearer ${appStore.authStore.user.access_token}`,
      },
    });
  }

  constructor(serviceName: string) {
    makeObservable(this);

    this.serviceName = serviceName;
  }

  @computed get env() {
    return envStore?.services?.get(this.serviceName);
  }

  @computed get userSettingsApi() {
    return this.apiConfig && new UserSettingsApi(this.apiConfig);
  }
}

export const apiGatewayStore = new ApiGatewayStore("gateway");
