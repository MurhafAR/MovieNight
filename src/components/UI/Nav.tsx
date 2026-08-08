"use client";

import styles from "@/app/styles/nav.module.css";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import LanguageToggle from "./LanguageToggle";

interface NavProps {
  children: ReactNode;
}
export default function Nav({ children }: NavProps) {
  const router = useRouter();
  return (
    <div className={styles.nav}>
      <div className={styles.logo} onClick={() => router.push("/")}>
        <span className={styles.green}>Movie</span>
        <span className={styles.blue}>Night</span>
      </div>
      <div className={styles.rightSide}>
        <LanguageToggle />
        {children}
      </div>
    </div>
  );
}
