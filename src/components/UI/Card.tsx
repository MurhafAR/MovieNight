import styles from "@/app/styles/card.module.css";
import { ReactNode } from "react";
interface CardProps {
  titleChildren: ReactNode;
  actionChildren: ReactNode;
  className?: ReactNode;
  cardColor?: string;
}
export default function Card({
  titleChildren,
  actionChildren,
  className = "",
  cardColor = "green",
}: CardProps) {
  const color = cardColor === "blue" ? styles.blue : styles.green;
  return (
    <div className={`${styles.card} ${className} ${color}`}>
      <div className={styles.cardTitle}>{titleChildren}</div>
      <div className={styles.cardFunction}>{actionChildren}</div>
    </div>
  );
}
