import { ReactNode } from "react";

export type InputType = "text" | "password" | "date" | "number" | "email";

export interface InputConfig {
    name: string;
    label: string;
    type: InputType;
    placeholder?: string;
    defaultValue?: string;
}

export interface FormProps {
    inputs?: InputConfig[];
    onSubmit?: (data: FormData) => void | Promise<void>;
    onChange?: (data: Record<string, string>) => void;
    submitButtonText?: string;
    showSubmitButton?: boolean;
    className?: ReactNode;
    children?: ReactNode;
    autoComplete?: boolean;
}