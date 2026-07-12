import React from "react";

type CardVariant = "default" | "success" | "warning";

const styles: Record<CardVariant, string> = {
  default: "rounded-2xl border bg-white p-5 shadow-sm",
  success: "rounded-2xl border bg-green-50 p-5 shadow-sm",
  warning: "rounded-2xl border bg-yellow-50 p-5 shadow-sm",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export default function Card({
  variant = "default",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div className={`${styles[variant]} ${className}`} {...props}>
      {children}
    </div>
  );
}
