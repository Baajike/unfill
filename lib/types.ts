export type TopicTier = "concrete" | "process" | "opinion";

export type Topic = {
  id: string;
  text: string;
  tier: TopicTier;
};

export type TimedWord = { word: string; start: number; end: number };
export type TimedSegment = { text: string; start: number; end: number };

export type Transcript = {
  text: string;
  durationSeconds: number;
  words: TimedWord[] | null;
  segments: TimedSegment[] | null;
};

export type FeedbackSource = "gemini" | "groq" | "none";

export type RepeatedWord = { word: string; count: number };

export type Metrics = {
  duration_seconds: number;
  word_count: number;
  words_per_minute: number;
  filler_count: number;
  fillers_per_minute: number;
  filler_breakdown: Record<string, number>;
  unique_word_ratio: number;
  top_repeated: RepeatedWord[];
  /** null when the transcript had no timestamps to measure pauses with. */
  long_pauses: number | null;
};

export type VocabularyUpgrade = {
  you_said: string;
  try_instead: string[];
  why: string;
};

export type Feedback = {
  summary: string;
  did_well: string;
  focus_next: string;
  vocabulary_upgrades: VocabularyUpgrade[];
  filler_tip: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** Hand-written to match supabase/migrations/0001_init.sql. */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          timezone: string | null;
          current_level: number;
          created_at: string;
        };
        Insert: {
          id: string;
          timezone?: string | null;
        };
        Update: {
          timezone?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          topic: string;
          topic_tier: TopicTier;
          target_seconds: number;
          duration_seconds: number;
          completed: boolean;
          transcript: string;
          metrics: Json;
          feedback: Json | null;
          feedback_source: FeedbackSource;
          created_at: string;
        };
        Insert: {
          user_id: string;
          topic: string;
          topic_tier: TopicTier;
          target_seconds: number;
          duration_seconds: number;
          completed: boolean;
          transcript: string;
          metrics: Json;
          feedback: Json | null;
          feedback_source: FeedbackSource;
        };
        Update: {
          topic?: string;
          topic_tier?: TopicTier;
          target_seconds?: number;
          duration_seconds?: number;
          completed?: boolean;
          transcript?: string;
          metrics?: Json;
          feedback?: Json | null;
          feedback_source?: FeedbackSource;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      apply_level_up: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
