import { makeObservable, observable, ObservableMap } from "mobx";

export interface EnvInterface {
  ws_server_url: string;
  api_base_path: string;
}

export class EnvStore {
  @observable isLoading: boolean;
  @observable services: ObservableMap<string, EnvInterface>;
  @observable error: Error | undefined;

  constructor() {
    makeObservable(this);
    this.isLoading = false;
    this.services = observable.map();
  }
}

export const envStore = new EnvStore();
