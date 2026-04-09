import { useState, useCallback, useRef, useEffect } from "react";
import { useModel } from "../hooks/useModel";
import { Header } from "../components/Header";
import { ModelLoader } from "../components/ModelLoader";
import { Chat } from "../components/Chat";
import { InputBar } from "../components/InputBar";
import { BrowserPanel } from "../components/BrowserPanel";
import type { ChatMessage, ModelVariant, MultimodalContent } from "../lib/types";
import {
  buildToolSystemPrompt,
  parseToolCall,
  executeToolCall,
  formatToolResult,
} from "../lib/browser-tools";
import { cn } from "../lib/utils";

const SUGGESTIONS = [
  "Explain how WebGPU works",
  "Write a Python fibonacci generator",
  "What makes Gemma 4 different from GPT?",
  "Tell me a creative short story",
];

const BROWSER_SUGGESTIONS = [
  "Open the demo page and read what's on it",
  "Go to the demo page, type my name in the form, and submit it",
  "Open the demo page and increment the counter 3 times",
  "Navigate to the demo and check off the todo items",
];

const MAX_AGENT_ROUNDS = 5;

export function Playground() {
  const {
    status,
    progress,
    output,
    stats,
    loadModel,
    generate,
    interrupt,
    error,
    currentVariant,
    onCompleteRef,
  } = useModel();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ModelVariant>("E2B");
  const [inputError, setInputError] = useState<string | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // Browser tools state
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const modelMessagesRef = useRef<ChatMessage[]>([]);
  const agentRoundsRef = useRef(0);
  const toolsEnabledRef = useRef(false);

  // Handle agent response: check for tool calls and continue the loop
  const handleAgentResponse = useCallback(
    (text: string) => {
      const parsed = parseToolCall(text);

      if (parsed.toolCall && agentRoundsRef.current < MAX_AGENT_ROUNDS) {
        agentRoundsRef.current++;

        // Add assistant's explanation text (before tool call) to display
        if (parsed.textBefore.trim()) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: parsed.textBefore.trim() },
          ]);
        }

        // Execute the tool
        const result = executeToolCall(
          parsed.toolCall,
          iframeRef.current,
          setBrowserUrl,
        );

        // Add tool call + result to display messages
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${parsed.toolCall!.name}(${Object.values(parsed.toolCall!.arguments).join(", ")})`,
            toolCall: parsed.toolCall!,
            toolResult: result,
            isToolMessage: true,
          },
        ]);

        // Update model conversation with raw assistant output and tool result
        modelMessagesRef.current = [
          ...modelMessagesRef.current,
          { role: "assistant", content: text },
          { role: "user", content: formatToolResult(result) },
        ];

        // Continue the agent loop with a small delay for iframe to load
        const delay = parsed.toolCall.name === "navigate" ? 1500 : 100;
        setTimeout(() => {
          const systemMessages: ChatMessage[] = [
            { role: "user", content: buildToolSystemPrompt() },
            {
              role: "assistant",
              content:
                "I understand. I have browser tools available and will use them when needed.",
            },
          ];
          generate([...systemMessages, ...modelMessagesRef.current]);
        }, delay);
      } else {
        // Normal response (no tool call) — add to display and model messages
        setMessages((prev) => [...prev, { role: "assistant", content: text }]);
        modelMessagesRef.current = [
          ...modelMessagesRef.current,
          { role: "assistant", content: text },
        ];
        agentRoundsRef.current = 0;
      }
    },
    [generate],
  );

  // Wire up the completion callback via useEffect (avoids ref access during render)
  useEffect(() => {
    onCompleteRef.current = (text: string) => {
      if (toolsEnabledRef.current) {
        handleAgentResponse(text);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      }
    };
    return () => { onCompleteRef.current = null; };
  }, [onCompleteRef, handleAgentResponse]);

  // Keep toolsEnabled ref in sync via effect
  useEffect(() => {
    toolsEnabledRef.current = toolsEnabled;
  }, [toolsEnabled]);

  // Handle interrupted generation: add partial output to messages
  const handleInterrupt = useCallback(() => {
    interrupt();
    setTimeout(() => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.isToolMessage) return prev;
        return [...prev, { role: "assistant", content: output || "(interrupted)" }];
      });
      if (toolsEnabledRef.current) {
        modelMessagesRef.current = [
          ...modelMessagesRef.current,
          { role: "assistant", content: output || "(interrupted)" },
        ];
        agentRoundsRef.current = 0;
      }
    }, 50);
  }, [interrupt, output]);

  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleSend = useCallback(
    (text: string, image?: File, audio?: Blob) => {
      const content: MultimodalContent[] = [];

      if (image) {
        const url = URL.createObjectURL(image);
        blobUrlsRef.current.push(url);
        content.push({ type: "image", image: url });
      }
      if (audio) {
        const url = URL.createObjectURL(audio);
        blobUrlsRef.current.push(url);
        content.push({ type: "audio", audio: url });
      }
      content.push({ type: "text", text });

      const userMessage: ChatMessage = {
        role: "user",
        content: content.length === 1 ? text : content,
      };

      if (toolsEnabled) {
        // Browser tools mode: manage model messages separately
        setMessages((prev) => [...prev, userMessage]);

        // Handle demo page shortcut
        let processedText = text;
        if (/demo\s*page/i.test(text) && !browserUrl) {
          const demoUrl = `${window.location.origin}${import.meta.env.BASE_URL}demo.html`;
          processedText = text.replace(
            /(?:the\s+)?demo\s*page/i,
            `the demo page (${demoUrl})`,
          );
        }

        const processedUserMessage: ChatMessage = {
          role: "user",
          content: processedText,
        };

        modelMessagesRef.current = [
          ...modelMessagesRef.current,
          processedUserMessage,
        ];
        agentRoundsRef.current = 0;

        const systemMessages: ChatMessage[] = [
          { role: "user", content: buildToolSystemPrompt() },
          {
            role: "assistant",
            content:
              "I understand. I have browser tools available and will use them when needed.",
          },
        ];

        const images = content
          .filter(
            (c): c is Extract<MultimodalContent, { type: "image" }> =>
              c.type === "image",
          )
          .map((c) => c.image);
        const audios = content
          .filter(
            (c): c is Extract<MultimodalContent, { type: "audio" }> =>
              c.type === "audio",
          )
          .map((c) => c.audio);

        generate(
          [...systemMessages, ...modelMessagesRef.current],
          images.length > 0 ? images : undefined,
          audios.length > 0 ? audios : undefined,
        );
      } else {
        // Standard mode: same as before
        setMessages((prev) => {
          const newMessages = [...prev, userMessage];

          const images = content
            .filter(
              (c): c is Extract<MultimodalContent, { type: "image" }> =>
                c.type === "image",
            )
            .map((c) => c.image);
          const audios = content
            .filter(
              (c): c is Extract<MultimodalContent, { type: "audio" }> =>
                c.type === "audio",
            )
            .map((c) => c.audio);

          generate(
            newMessages,
            images.length > 0 ? images : undefined,
            audios.length > 0 ? audios : undefined,
          );

          return newMessages;
        });
      }
    },
    [generate, toolsEnabled, browserUrl],
  );

  const handleToggleTools = useCallback(() => {
    setToolsEnabled((prev) => {
      const next = !prev;
      if (next) {
        // Entering browser mode: sync model messages from display messages
        modelMessagesRef.current = messages.filter((m) => !m.isToolMessage);
      }
      return next;
    });
  }, [messages]);

  const handleBrowserNavigate = useCallback((url: string) => {
    setBrowserUrl(url);
    if (iframeRef.current) iframeRef.current.src = url;
  }, []);

  const isGenerating = status === "generating";
  const hasMessages = messages.length > 0 || isGenerating;

  // Loading state - model selector + loader
  if (status !== "ready" && status !== "generating") {
    return (
      <div className="h-screen flex flex-col">
        <Header modelStatus={status} currentVariant={currentVariant} />
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex gap-2 mb-6">
            {(["E2B", "E4B"] as ModelVariant[]).map((v) => (
              <button
                key={v}
                onClick={() => setSelectedVariant(v)}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                  selectedVariant === v
                    ? "bg-white text-black"
                    : "bg-neutral-800 text-neutral-400 hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <ModelLoader
            variant={selectedVariant}
            progress={progress}
            onLoad={loadModel}
            isLoading={status === "loading"}
            isReady={false}
          />
          {error && (
            <p className="mt-4 text-red-400 text-sm max-w-md text-center">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header modelStatus={status} currentVariant={currentVariant} />

      {/* Browser tools toggle */}
      <div className="border-b border-neutral-800 bg-neutral-950/50">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between">
          <button
            onClick={handleToggleTools}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-all",
              toolsEnabled
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "bg-neutral-800/50 text-neutral-400 border border-neutral-700 hover:text-white hover:border-neutral-600",
            )}
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
              />
            </svg>
            Browser Tools
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                toolsEnabled ? "bg-indigo-400" : "bg-neutral-600",
              )}
            />
          </button>
          {toolsEnabled && (
            <span className="text-xs text-neutral-500">
              AI can browse web pages and interact with them
            </span>
          )}
        </div>
      </div>

      {hasMessages ? (
        // Chat mode - with optional browser panel
        <div className={cn("flex-1 flex min-h-0", toolsEnabled && "flex-row")}>
          {/* Chat column */}
          <div
            className={cn(
              "flex flex-col min-h-0",
              toolsEnabled ? "w-1/2 border-r border-neutral-800" : "w-full",
            )}
          >
            <Chat
              messages={messages}
              streamingOutput={output}
              isGenerating={isGenerating}
              stats={stats}
            />
            {inputError && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center">
                {inputError}
              </div>
            )}
            <div
              className={cn(
                "mx-auto w-full px-2 md:px-0",
                toolsEnabled ? "max-w-full px-2" : "max-w-3xl",
              )}
            >
              <InputBar
                onSend={handleSend}
                onInterrupt={handleInterrupt}
                isGenerating={isGenerating}
                disabled={status !== "ready" && status !== "generating"}
                onError={(msg) => {
                  setInputError(msg);
                  setTimeout(() => setInputError(null), 5000);
                }}
              />
            </div>
          </div>

          {/* Browser panel */}
          {toolsEnabled && (
            <div className="w-1/2 min-h-0">
              <BrowserPanel
                ref={iframeRef}
                url={browserUrl}
                onNavigate={handleBrowserNavigate}
              />
            </div>
          )}
        </div>
      ) : (
        // Empty state - centered welcome
        <div
          className={cn(
            "flex-1 flex min-h-0",
            toolsEnabled && "flex-row",
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center p-3 md:p-4",
              toolsEnabled
                ? "w-1/2 border-r border-neutral-800"
                : "w-full",
            )}
          >
            <div className="max-w-2xl w-full space-y-6 md:space-y-8">
              {/* Welcome */}
              <div className="text-center space-y-2">
                <img
                  src={`${import.meta.env.BASE_URL}onix.webp`}
                  alt="Onix"
                  className="w-16 h-16 mx-auto object-contain opacity-60"
                />
                <h2 className="text-xl font-semibold md:text-2xl">
                  {toolsEnabled
                    ? "Browse the web with AI"
                    : "What can I help with?"}
                </h2>
                <p className="text-sm text-neutral-500">
                  {toolsEnabled
                    ? "Ask me to navigate, click, type, or read web pages. Try the built-in demo page!"
                    : `Running Gemma 4 ${currentVariant} locally via WebGPU. Text, images, and audio supported.`}
                </p>
              </div>

              {/* Centered input */}
              <div className="max-w-xl mx-auto">
                <InputBar
                  onSend={handleSend}
                  onInterrupt={handleInterrupt}
                  isGenerating={isGenerating}
                  disabled={status !== "ready" && status !== "generating"}
                  placeholder={
                    toolsEnabled
                      ? "Ask me to interact with a web page..."
                      : "Ask anything..."
                  }
                  onError={(msg) => {
                    setInputError(msg);
                    setTimeout(() => setInputError(null), 5000);
                  }}
                />
              </div>

              {inputError && (
                <p className="text-xs text-red-400 text-center">
                  {inputError}
                </p>
              )}

              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2 justify-center">
                {(toolsEnabled ? BROWSER_SUGGESTIONS : SUGGESTIONS).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
                    >
                      {s}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          {/* Browser panel in empty state too */}
          {toolsEnabled && (
            <div className="w-1/2 min-h-0">
              <BrowserPanel
                ref={iframeRef}
                url={browserUrl}
                onNavigate={handleBrowserNavigate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
