export type ModelVariant = "E2B" | "E4B";

export type ModelStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface ProgressInfo {
  file: string;
  loaded: number;
  total: number;
}

export function progressPercent(p: ProgressInfo): number {
  return p.total > 0 ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0;
}

export interface GenerationStats {
  numTokens: number;
  tps: number;
  totalTime: number;
  ttft: number | null;
}

export type MultimodalContent =
  | { type: "text"; text: string }
  | { type: "image"; image: string }
  | { type: "audio"; audio: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | MultimodalContent[];
  /** Present when this message represents a tool call (display only) */
  toolCall?: ToolCall;
  /** Present when this message includes a tool result (display only) */
  toolResult?: ToolResult;
  /** True if this is a tool-related display message */
  isToolMessage?: boolean;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, string>;
}

export interface ToolResult {
  name: string;
  result: string;
  success: boolean;
}

export function getTextContent(content: string | MultimodalContent[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");
}

// Worker response messages - typed contract between worker and main thread
export type WorkerResponse =
  | { status: "loading"; variant: ModelVariant }
  | { status: "progress"; file: string; loaded: number; total: number; variant: ModelVariant }
  | { status: "ready"; variant: ModelVariant }
  | { status: "update"; token: string; numTokens: number; tps: number; elapsed: number; ttft: number | null }
  | { status: "complete"; numTokens: number; tps: number; totalTime: number; ttft: number | null }
  | { status: "interrupted" }
  | { status: "unloaded" }
  | { status: "error"; error: string }
  | { status: "prefetch-progress"; file: string; loaded: number; total: number; variant: ModelVariant }
  | { status: "prefetch-done"; variant: ModelVariant };
