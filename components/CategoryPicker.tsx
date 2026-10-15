"use client";

import { useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/Button";

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
  className = "",
}: {
  categories: readonly Category[];
  className?: string;
}) {
  // The server always renders the default, so hydration matches; the stored choice applies after.
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  // A stored value is only used if it's still on the list.
  const selected = categories.find((c) => c.id === stored)?.id ?? DEFAULT_ID;

  return (
    <div className={className}>
      <fieldset>
        <legend className="text-sm text-muted">Topic</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="cursor-pointer">
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
                  "inline-flex min-h-10 select-none items-center rounded-full px-4 text-[0.9375rem] " +
                  "transition-colors duration-150 bg-surface text-muted hover:text-ink " +
                  "peer-checked:bg-accent peer-checked:text-white " +
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                }
              >
                {c.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <ButtonLink
        href={selected === DEFAULT_ID ? "/session" : `/session?category=${encodeURIComponent(selected)}`}
        size="xl"
        className="mt-8 w-full"
      >
        Start
      </ButtonLink>
    </div>
  );
}
