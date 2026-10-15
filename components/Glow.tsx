/** Soft pastel light behind every screen. Purely decorative. */
export function Glow() {
  const blob = "absolute rounded-full blur-3xl";
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className={`${blob} -top-40 -left-40 h-[28rem] w-[28rem]`}
        style={{ background: "radial-gradient(circle, rgba(178,226,199,.34) 0%, rgba(178,226,199,0) 70%)" }}
      />
      <div
        className={`${blob} -top-32 -right-44 h-[26rem] w-[26rem]`}
        style={{ background: "radial-gradient(circle, rgba(255,207,173,.34) 0%, rgba(255,207,173,0) 70%)" }}
      />
      <div
        className={`${blob} -bottom-44 -left-36 h-[26rem] w-[26rem]`}
        style={{ background: "radial-gradient(circle, rgba(196,186,247,.3) 0%, rgba(196,186,247,0) 70%)" }}
      />
      <div
        className={`${blob} -right-40 -bottom-40 h-[28rem] w-[28rem]`}
        style={{ background: "radial-gradient(circle, rgba(170,212,240,.32) 0%, rgba(170,212,240,0) 70%)" }}
      />
    </div>
  );
}
