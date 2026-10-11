import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-accent text-accent-text shadow-panel hover:bg-accent-strong",
  secondary: "bg-surface text-ink shadow-panel hover:bg-surface-2",
  ghost: "text-muted hover:bg-track hover:text-ink",
};

// Controls are full pills (radius rule in globals.css / DESIGN.md).
export const buttonClass = (variant: Variant = "primary", className = "") =>
  `inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${styles[variant]} ${className}`;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
