// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

export const SUPPORTED_LOCALES = ["en", "es"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function detectLocale(): SupportedLocale {
  const stored = localStorage.getItem("locale");
  if (stored === "en" || stored === "es") return stored;

  const browser = navigator.language.split("-")[0].toLowerCase();
  if (browser === "en" || browser === "es") return browser as SupportedLocale;

  return "en";
}

i18next.use(initReactI18next).init({
  lng: detectLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
});

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof en;
    };
  }
}

export default i18next;

