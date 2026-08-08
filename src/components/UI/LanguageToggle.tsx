"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Languages } from "lucide-react";
import styles from "@/app/styles/nav.module.css";

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();

  return (
    <button
      className={styles.blueIcon}
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
      title={locale === "en" ? "العربية" : "English"}
    >
      <Languages size={18} />
    </button>
  );
}
