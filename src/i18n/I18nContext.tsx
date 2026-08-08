"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import en from "./locales/en";
import ar from "./locales/ar";
import type { Translations } from "./locales/en";

type Locale = "en" | "ar";

const translations: Record<Locale, Translations> = { en, ar };

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function t(
  key: string,
  locale: Locale,
  params?: Record<string, string | number>
): string {
  const value = getNestedValue(translations[locale], key);
  if (typeof value !== "string") {
    const fallback = getNestedValue(translations.en, key);
    if (typeof fallback === "string") return fallback;
    return key;
  }
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? `{${p}}`));
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null;
    if (stored === "en" || stored === "ar") {
      setLocaleState(stored);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      t(key, locale, params),
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: translate,
        dir: locale === "ar" ? "rtl" : "ltr",
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("translator must be used within its provider!");
  return ctx;
}
