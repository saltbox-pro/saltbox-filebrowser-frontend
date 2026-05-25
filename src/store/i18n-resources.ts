import { AppLanguage } from "@saltbox/saltbox-frontend-common";
import type { Resource } from "i18next";

import enBase from "../locales/en/base.json";
import ruBase from "../locales/ru/base.json";

export const filesystemResources: Resource = {
  [AppLanguage.EN]: { base: enBase },
  [AppLanguage.RU]: { base: ruBase },
};
