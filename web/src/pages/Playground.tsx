import { useState, useCallback, useRef, useEffect } from "react";
import { useModel } from "../hooks/useModel";
import { Header } from "../components/Header";
import { ModelLoader } from "../components/ModelLoader";
import { Chat } from "../components/Chat";
import { InputBar } from "../components/InputBar";
import type { ChatMessage, ModelVariant, MultimodalContent } from "../lib/types";

const SUGGESTIONS = [
  "Explain how WebGPU works",
  "Write a Python fibonacci generator",
  "What makes Gemma 4 different from GPT?",
  "Tell me a creative short story",
];

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
  } = useModel();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ModelVariant>("E2B");
  const [inputError, setInputError] = useState<string | null>(null);
  const wasGeneratingRef = useRef(false);
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (wasGeneratingRef.current && status !== "generating") {
      const text = output || "(no response)";
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    }
    wasGeneratingRef.current = status === "generating";
  }, [status, output]);

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

      setMessages((prev) => {
        const newMessages = [...prev, userMessage];

        const images = content
          .filter((c): c is Extract<MultimodalContent, { type: "image" }> => c.type === "image")
          .map((c) => c.image);
        const audios = content
          .filter((c): c is Extract<MultimodalContent, { type: "audio" }> => c.type === "audio")
          .map((c) => c.audio);

        generate(
          newMessages,
          images.length > 0 ? images : undefined,
          audios.length > 0 ? audios : undefined,
        );

        return newMessages;
      });
    },
    [generate],
  );

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
            <p className="mt-4 text-red-400 text-sm max-w-md text-center">{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header modelStatus={status} currentVariant={currentVariant} />

      {hasMessages ? (
        // Chat mode - messages + bottom input
        <>
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
          <div className="max-w-3xl mx-auto w-full px-2 md:px-0">
            <InputBar
              onSend={handleSend}
              onInterrupt={interrupt}
              isGenerating={isGenerating}
              disabled={status !== "ready" && status !== "generating"}
              onError={(msg) => {
                setInputError(msg);
                setTimeout(() => setInputError(null), 5000);
              }}
            />
          </div>
        </>
      ) : (
        // Empty state - centered welcome
        <div className="flex-1 flex items-center justify-center p-3 md:p-4">
          <div className="max-w-2xl w-full space-y-6 md:space-y-8">
            {/* Welcome */}
            <div className="text-center space-y-2">
              <img
                src={`${import.meta.env.BASE_URL}onix.webp`}
                alt="Onix"
                className="w-16 h-16 mx-auto object-contain opacity-60"
              />
              <h2 className="text-xl font-semibold md:text-2xl">What can I help with?</h2>
              <p className="text-sm text-neutral-500">
                Running Gemma 4 {currentVariant} locally via WebGPU. Text, images, and audio supported.
              </p>
            </div>

            {/* Centered input */}
            <div className="max-w-xl mx-auto">
              <InputBar
                onSend={handleSend}
                onInterrupt={interrupt}
                isGenerating={isGenerating}
                disabled={status !== "ready" && status !== "generating"}
                placeholder="Ask anything..."
                onError={(msg) => {
                  setInputError(msg);
                  setTimeout(() => setInputError(null), 5000);
                }}
              />
            </div>

            {inputError && (
              <p className="text-xs text-red-400 text-center">{inputError}</p>
            )}

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
