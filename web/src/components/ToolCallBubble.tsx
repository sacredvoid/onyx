import type { ToolCall, ToolResult } from "../lib/types";
import { cn } from "../lib/utils";

interface ToolCallBubbleProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isExecuting?: boolean;
}

const TOOL_ICONS: Record<string, string> = {
  navigate: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
  read_page: "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z",
  click: "M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59",
  type_text: "m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10",
  scroll: "M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5-6L16.5 15m0 0L12 10.5m4.5 4.5V1.5",
  get_page_info: "m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z",
};

function formatArgs(args: Record<string, string>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}

export function ToolCallBubble({
  toolCall,
  toolResult,
  isExecuting,
}: ToolCallBubbleProps) {
  const iconPath = TOOL_ICONS[toolCall.name] ?? TOOL_ICONS.click;

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-xl border border-neutral-700 bg-neutral-900 overflow-hidden text-xs">
        {/* Tool call header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50">
          <svg
            className={cn(
              "w-3.5 h-3.5 shrink-0",
              isExecuting ? "text-blue-400 animate-pulse" : "text-neutral-400",
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
          <span className="font-mono text-neutral-300">{toolCall.name}</span>
          {isExecuting && (
            <span className="text-blue-400 animate-pulse">running...</span>
          )}
        </div>

        {/* Arguments */}
        {Object.keys(toolCall.arguments).length > 0 && (
          <div className="px-3 py-1.5 border-t border-neutral-800 text-neutral-400 font-mono">
            {formatArgs(toolCall.arguments)}
          </div>
        )}

        {/* Result */}
        {toolResult && (
          <div
            className={cn(
              "px-3 py-2 border-t border-neutral-800",
              toolResult.success ? "text-green-400" : "text-red-400",
            )}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span>{toolResult.success ? "ok" : "err"}</span>
            </div>
            <p className="text-neutral-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {toolResult.result.length > 300
                ? toolResult.result.slice(0, 300) + "..."
                : toolResult.result}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
