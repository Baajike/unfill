import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg" | "xl";

const base =
  "inline-flex select-none items-center justify-center rounded-full font-bold transition " +
  "duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-gradient text-white shadow-primary hover:brightness-[1.04] active:shadow-primary-pressed",
  secondary:
    "border border-border bg-white text-ink shadow-soft hover:bg-field active:shadow-none",
  ghost: "text-muted hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-lg",
  xl: "min-h-16 px-10 text-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "lg", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

/** Small white pill used for header links (Words, History, Back, Home). */
export const pillLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-white px-4 " +
  "text-sm font-bold text-ink shadow-soft transition duration-150 hover:bg-field active:translate-y-px active:shadow-none";

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
