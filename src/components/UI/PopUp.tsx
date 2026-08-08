"use client";
import styles from "@/app/styles/popup.module.css";
import { ReactNode } from "react";
import { XIcon } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
interface PopUpProps {
  section1Children: ReactNode;
  section2Children: ReactNode;
  className?: ReactNode;
  section1Styles?: ReactNode;
  section2Styles?: ReactNode;
  popUpColor: string;
  onClose?: () => void;
}
export default function PopUp({
  section1Children,
  section2Children,
  className = "",
  section1Styles,
  section2Styles,
  popUpColor = "green",
  onClose,
}: PopUpProps) {
  const color = popUpColor === "blue" ? styles.blue : styles.green;
  const { t } = useI18n();
  return (
    <div className={styles.background}>
      <div className={`${styles.pop} ${className} ${color}`}>
        {onClose && <span title={t("room.close")}><XIcon className={styles.cancel} onClick={onClose}></XIcon></span>}
        <div className={`${styles.section1} ${section1Styles}`}>
          {section1Children}
        </div>
        <div className={`${styles.section2} ${section2Styles}`}>
          {section2Children}
        </div>
      </div>
    </div>
  );
}
