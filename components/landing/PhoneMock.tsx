import { Logo } from "@/components/Logo";
import { TINT, type Tint } from "@/components/categoryTint";

function MockStat({ tint, label, value, unit }: { tint: Tint; label: string; value: string; unit: string }) {
  const t = TINT[tint];
  return (
    <div className={`flex min-w-0 flex-col rounded-2xl p-2.5 ${t.gradient} ${t.shadow}`}>
      <p className={`text-[0.5625rem] font-extrabold tracking-[0.7px] uppercase ${t.text}`}>{label}</p>
      <p className="mt-1.5 flex items-baseline gap-0.5">
        <span className="text-xl leading-none font-extrabold tracking-tight">{value}</span>
        <span className={`text-[0.6875rem] font-bold ${t.text}`}>{unit}</span>
      </p>
    </div>
  );
}

const CHIPS: Array<{ label: string; tint: Tint }> = [
  { label: "Random", tint: "mint" },
  { label: "Food", tint: "peach" },
  { label: "Science", tint: "lavender" },
  { label: "Technology", tint: "sky" },
];

/** A static picture of the Home screen inside a phone frame. Decorative only. */
export function PhoneMock() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-[300px] select-none">
      <div className="rounded-[40px] border border-border bg-white p-2.5 shadow-card">
        <div className="relative overflow-hidden rounded-[32px] bg-white px-4 pt-8 pb-6 ring-1 ring-border">
          <div className="absolute top-2.5 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-border" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size="sm" className="scale-75" />
              <span className="text-sm font-extrabold tracking-tight">Unfill</span>
            </div>
            <div className="flex gap-1.5">
              <span className="rounded-full border border-border px-2.5 py-1 text-[0.625rem] font-bold shadow-soft">
                Words
              </span>
              <span className="rounded-full border border-border px-2.5 py-1 text-[0.625rem] font-bold shadow-soft">
                History
              </span>
            </div>
          </div>

          <p className="mt-4 text-lg leading-tight font-extrabold tracking-tight">Good morning</p>
          <p className="text-[0.6875rem] text-muted">Ready for today&apos;s session?</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MockStat tint="peach" label="Streak" value="3" unit="days" />
            <MockStat tint="mint" label="Today" value="1" unit="min" />
            <MockStat tint="lavender" label="Sessions" value="12" unit="total" />
          </div>

          <p className="mt-4 text-[0.5625rem] font-extrabold tracking-[0.7px] text-label uppercase">Words to try today</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {["vivid", "nuance", "pivot"].map((w) => (
              <span key={w} className="rounded-full bg-sky px-2.5 py-1 text-[0.6875rem] font-bold text-sky-ink">
                {w}
              </span>
            ))}
          </div>

          <p className="mt-4 text-[0.5625rem] font-extrabold tracking-[0.7px] text-label uppercase">Topic</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CHIPS.map((c, i) => (
              <span
                key={c.label}
                className={
                  "rounded-full px-2.5 py-1 text-[0.6875rem] font-bold " +
                  (i === 0 ? "bg-ink text-white shadow-chip" : `${TINT[c.tint].bg} ${TINT[c.tint].text}`)
                }
              >
                {c.label}
              </span>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-lavender/70" />
              <span className="absolute inset-2 rounded-full bg-mint" />
              <span className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary-radial text-lg font-extrabold text-white shadow-primary">
                Start
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
