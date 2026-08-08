import styles from "@/app/styles/form.module.css";

import { FormProps } from "@/app/types/form";
export default function Form({
  inputs,
  onSubmit,
  showSubmitButton,
  onChange,
  children,
  className,
  autoComplete = false,
}: FormProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const form = event.currentTarget;

    if (onSubmit) {
      event.preventDefault();
      onSubmit(formData);
      form.reset();
    }
  };
  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {inputs === undefined
        ? null
        : inputs.map((input) => (
            <div key={input.name} className={styles.inputGroup}>
              <label htmlFor={input.name}>{input.label}</label>
              <input
                id={input.name}
                name={input.name}
                type={input.type}
                placeholder={input.placeholder}
                defaultValue={input.defaultValue}
                className={`${styles.inputField} ${className}`}
                autoComplete={autoComplete ? "on" : "off"}
              />
            </div>
          ))}

      {children}
    </form>
  );
}
