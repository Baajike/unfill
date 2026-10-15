/** The Unfill mark, drawn in a 100×100 box: a thin green ring with a bold lowercase "u". */
export const MARK_GREEN = "#3F6B50";
export const MARK_RING = { cx: 50, cy: 50, r: 34, strokeWidth: 3.5 };
export const MARK_U = { d: "M37 37V53.5A13 13 0 0 0 63 53.5V37M63 53.5V66", strokeWidth: 9 };

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <circle {...MARK_RING} stroke={MARK_GREEN} />
      <path d={MARK_U.d} stroke={MARK_GREEN} strokeWidth={MARK_U.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SIZES = { lg: 88, sm: 40 } as const;

/** White disc with a soft green shadow around the mark. Decorative: the name sits beside it. */
export function Logo({ size = "sm", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const px = SIZES[size];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white ${className}`}
      style={{
        width: px,
        height: px,
        boxShadow:
          size === "lg"
            ? "0 1px 2px rgba(21,32,26,.06), 0 10px 26px rgba(63,107,80,.24)"
            : "0 1px 2px rgba(21,32,26,.06), 0 4px 12px rgba(63,107,80,.22)",
      }}
    >
      <Mark size={px} />
    </span>
  );
}
