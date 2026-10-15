"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { TINT, categoryTint } from "@/components/categoryTint";

const STORAGE_KEY = "unfill:topic-category";
const DEFAULT_ID = "random";

// The last choice, kept in memory too so picking still works when storage is blocked.
let memory: string | null = null;
const listeners = new Set<() => void>();

function readStored(): string | null {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(id: string) {
  memory = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type Category = { id: string; label: string };

export function CategoryPicker({
  categories,
  minutes,
  className = "",
}: {
  categories: readonly Category[];
  minutes: number;
  className?: string;
}) {
  // The server always renders the default, so hydration matches; the stored choice applies after.
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  // A stored value is only used if it's still on the list.
  const selected = categories.find((c) => c.id === stored)?.id ?? DEFAULT_ID;

  return (
    <div className={className}>
      <fieldset>
        <legend className="section-label">Topic</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => {
            const tint = TINT[c.id === DEFAULT_ID ? "mint" : categoryTint(c.id)];
            return (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center">
                <input
                  type="radio"
                  name="topic-category"
                  value={c.id}
                  checked={selected === c.id}
                  onChange={() => store(c.id)}
                  className="peer sr-only"
                />
                <span
                  className={
                    `inline-flex h-[38px] select-none items-center rounded-full px-4 text-sm font-bold ` +
                    `transition duration-150 ${tint.bg} ${tint.text} ` +
                    "peer-checked:bg-ink peer-checked:text-white peer-checked:shadow-chip " +
                    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
                  }
                >
                  {c.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-10 flex flex-col items-center">
        <div className="relative flex h-[216px] w-[216px] items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-lavender/70" />
          <span aria-hidden className="absolute inset-[14px] rounded-full bg-mint" />
          <Link
            href={selected === DEFAULT_ID ? "/session" : `/session?category=${encodeURIComponent(selected)}`}
            className={
              "relative inline-flex h-40 w-40 select-none items-center justify-center rounded-full " +
              "bg-primary-radial text-2xl font-extrabold text-white shadow-primary transition duration-150 " +
              "hover:brightness-[1.04] active:translate-y-px active:shadow-primary-pressed"
            }
          >
            Start
          </Link>
        </div>
        <p className="mt-3 text-sm text-muted">
          {minutes} {minutes === 1 ? "minute" : "minutes"} · speak without stopping
        </p>
      </div>
    </div>
  );
}
