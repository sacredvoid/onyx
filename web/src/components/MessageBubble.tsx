import ReactMarkdown from "react-markdown";
import type { ChatMessage, MultimodalContent } from "../lib/types";
import { getTextContent, cn } from "../lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const textContent = getTextContent(message.content);

  const multimodal: MultimodalContent[] =
    typeof message.content !== "string" ? message.content : [];

  const imageContent = multimodal.filter(
    (c): c is Extract<MultimodalContent, { type: "image" }> => c.type === "image",
  );
  const audioContent = multimodal.filter(
    (c): c is Extract<MultimodalContent, { type: "audio" }> => c.type === "audio",
  );

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-blue-600 text-white"
            : "bg-neutral-800 text-neutral-100",
        )}
      >
        {imageContent.map((img, i) => (
          <img
            key={i}
            src={img.image}
            alt="uploaded"
            className="max-w-full rounded-lg mb-2 max-h-64 object-contain"
          />
        ))}
        {audioContent.map((aud, i) => (
          <audio key={i} controls src={aud.audio} className="mb-2 w-full" />
        ))}
        {isUser ? (
          <p className="whitespace-pre-wrap">{textContent}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-neutral-100 prose-p:text-neutral-200 prose-strong:text-white prose-li:text-neutral-200 prose-code:text-indigo-300 prose-code:bg-neutral-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-700">
            <ReactMarkdown>{textContent}</ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-neutral-400 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}
