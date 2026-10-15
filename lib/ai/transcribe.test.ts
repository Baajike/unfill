import { describe, expect, it, vi } from "vitest";

// The real package throws outside a React Server Components build.
vi.mock("server-only", () => ({}));

const { filterHallucinations } = await import("./transcribe");

type Seg = {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
};

const real = (start: number, text: string, extra: Partial<Seg> = {}): Seg => ({
  start,
  end: start + 4,
  text,
  no_speech_prob: 0.02,
  avg_logprob: -0.3,
  compression_ratio: 1.3,
  ...extra,
});

function run(segments: Seg[], words: Array<{ word: string; start: number; end: number }> | null = null) {
  return filterHallucinations({ text: segments.map((s) => s.text).join(" "), words, segments });
}

describe("filterHallucinations", () => {
  it("keeps normal speech untouched", () => {
    const out = run([real(0, "I wear trainers most days."), real(4, "They are comfortable.")]);
    expect(out.text).toBe("I wear trainers most days. They are comfortable.");
    expect(out.dropped).toEqual({});
  });

  it("removes the silent-recording hallucination from the bug report", () => {
    const out = run([
      real(0, " Subtitles by the Amara.org community", { no_speech_prob: 0.1 }),
      real(4, " like, you know, like, you know, like, you know", { compression_ratio: 3.1 }),
      real(8, " Umm, so, uh, I was like, you know, thinking about it", { no_speech_prob: 0.35 }),
    ]);
    expect(out.text).toBe("");
    expect(out.segments).toBeNull();
    expect(out.dropped).toEqual({ phrase: 1, repetition: 1, prompt_echo: 1 });
  });

  it("drops known credit and outro phrases case-insensitively", () => {
    const out = run([real(0, "THANKS FOR WATCHING!"), real(4, "Please subscribe."), real(8, "Hello there.")]);
    expect(out.text).toBe("Hello there.");
    expect(out.dropped.phrase).toBe(2);
  });

  it("drops segments Whisper thinks are not speech", () => {
    const out = run([
      real(0, "Shoes are useful.", { no_speech_prob: 0.85 }),
      real(4, "Quiet bit.", { no_speech_prob: 0.6, avg_logprob: -1.2 }),
      real(8, "Garbled.", { avg_logprob: -1.6 }),
      real(12, "Kept because only one signal is weak.", { no_speech_prob: 0.6, avg_logprob: -0.4 }),
    ]);
    expect(out.text).toBe("Kept because only one signal is weak.");
    expect(out.dropped).toEqual({ no_speech: 1, low_confidence: 2 });
  });

  it("keeps a real speaker naturally saying a phrase from the prompt", () => {
    const sentence = "I was like, you know, thinking about it for ages before buying new running shoes.";
    const out = run([real(0, sentence, { no_speech_prob: 0.05 })]);
    expect(out.text).toBe(sentence);
  });

  it("drops a prompt copy that is mostly prompt words even with low no-speech probability", () => {
    const out = run([real(0, "Umm, so, uh, I was like, you know, thinking about it, hmm", { no_speech_prob: 0.05 })]);
    expect(out.dropped).toEqual({ prompt_echo: 1 });
  });

  it("does not treat short filler-only speech as a prompt copy", () => {
    const out = run([real(0, "Um, uh, like.", { no_speech_prob: 0.05 })]);
    expect(out.text).toBe("Um, uh, like.");
  });

  it("keeps only word timestamps inside kept segments", () => {
    const out = run(
      [real(0, "Thanks for watching"), real(4, "Real words here")],
      [
        { word: "Thanks", start: 0.2, end: 0.6 },
        { word: "Real", start: 4.1, end: 4.4 },
        { word: "words", start: 4.5, end: 4.9 },
      ],
    );
    expect(out.words?.map((w) => w.word)).toEqual(["Real", "words"]);
  });

  it("returns null word timestamps when every word was dropped", () => {
    const out = run([real(0, "Amara.org")], [{ word: "Amara.org", start: 0, end: 1 }]);
    expect(out.words).toBeNull();
  });

  it("applies the phrase list when there are no segments", () => {
    expect(filterHallucinations({ text: "Thank you for watching.", words: null, segments: null }).text).toBe("");
    expect(filterHallucinations({ text: " Hello. ", words: null, segments: null }).text).toBe("Hello.");
  });
});
