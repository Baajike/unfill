/** Extra pastel light behind the hero only. Purely decorative. */
export function HeroGlow() {
  const blob = "absolute rounded-full blur-3xl";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div
        className={`${blob} top-0 left-[-10%] h-[22rem] w-[22rem]`}
        style={{ background: "radial-gradient(circle, rgba(178,226,199,.45) 0%, rgba(178,226,199,0) 70%)" }}
      />
      <div
        className={`${blob} top-[20%] right-[-5%] h-[24rem] w-[24rem]`}
        style={{ background: "radial-gradient(circle, rgba(196,186,247,.4) 0%, rgba(196,186,247,0) 70%)" }}
      />
      <div
        className={`${blob} bottom-[-10%] left-[30%] h-[18rem] w-[18rem]`}
        style={{ background: "radial-gradient(circle, rgba(255,207,173,.35) 0%, rgba(255,207,173,0) 70%)" }}
      />
    </div>
  );
}
