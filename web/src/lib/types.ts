export type ModelVariant = "E2B" | "E4B";

export type ModelStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface ProgressInfo {
  file: string;
  loaded: number;
  total: number;
}

export interface GenerationStats {
  numTokens: number;
  tps: number;
  totalTime: number;
  ttft: number | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | MultimodalContent[];
}

export interface MultimodalContent {
  type: "text" | "image" | "audio";
  text?: string;
  image?: string;
  audio?: string;
}
