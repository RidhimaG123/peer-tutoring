import React from "react";

type ButtonVariant = "primary" | "secondary" | "accent" | "link";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: React.ReactNode;
}

const styles: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50",
  secondary:
    "border border-zinc-300 rounded-xl px-4 py-2 text-sm hover:bg-zinc-50 transition-colors disabled:opacity-50",
  accent:
    "bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50",
  link:
    "text-indigo-600 underline hover:text-indigo-700 transition-colors disabled:opacity-50",
};

export default function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button className={`${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
