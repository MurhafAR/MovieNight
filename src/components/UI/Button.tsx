import styles from "@/app/styles/button.module.css";
import { MouseEventHandler, ReactNode } from "react";

type ButtonType = "submit" | "button" | "reset";

interface ButtonProps {
  text: ReactNode;
  className?: ReactNode;
  buttonColor?: string;
  type?: ButtonType;
  action?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
}
export default function Button({
  text,
  className = "",
  buttonColor = "green",
  type = "submit",
  action,
  children,
}: ButtonProps) {
  const color = buttonColor === "blue" ? styles.blue : styles.green;
  return (
    <button
      className={`${styles.button} ${className} ${color}`}
      type={type}
      onClick={action}
    >
      {children}
      {text}
    </button>
  );
}
