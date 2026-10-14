import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg" | "xl";

const base =
  "inline-flex select-none items-center justify-center rounded-full font-medium transition " +
  "duration-200 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong",
  secondary: "bg-surface text-ink hover:bg-line",
  ghost: "text-muted hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
  xl: "min-h-20 px-10 text-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "lg", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type Common = { variant?: Variant; size?: Size };

export function Button({
  variant,
  size,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & Common) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className = "",
  ...props
}: ComponentProps<typeof Link> & Common) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
