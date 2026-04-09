import { useState, useCallback, useRef, useEffect } from "react";
import { useModel } from "../hooks/useModel";
import { Header } from "../components/Header";
import { ModelLoader } from "../components/ModelLoader";
import { Chat } from "../components/Chat";
import { InputBar } from "../components/InputBar";
import type { ChatMessage, ModelVariant, MultimodalContent } from "../lib/types";

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
  const wasGeneratingRef = useRef(false);

  // When generation completes, add assistant message to history
  useEffect(() => {
    if (wasGeneratingRef.current && status !== "generating" && output) {
      setMessages((prev) => [...prev, { role: "assistant", content: output }]);
    }
    wasGeneratingRef.current = status === "generating";
  }, [status, output]);

  const handleSend = useCallback(
    (text: string, image?: File, audio?: Blob) => {
      const content: MultimodalContent[] = [];

      if (image) {
        const url = URL.createObjectURL(image);
        content.push({ type: "image", image: url });
      }
      if (audio) {
        const url = URL.createObjectURL(audio);
        content.push({ type: "audio", audio: url });
      }
      content.push({ type: "text", text });

      const userMessage: ChatMessage = {
        role: "user",
        content: content.length === 1 ? text : content,
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      const images = content
        .filter((c) => c.type === "image")
        .map((c) => c.image!);
      const audios = content
        .filter((c) => c.type === "audio")
        .map((c) => c.audio!);

      generate(
        newMessages,
        images.length > 0 ? images : undefined,
        audios.length > 0 ? audios : undefined,
      );
    },
    [messages, generate],
  );

  const isGenerating = status === "generating";

  return (
    <div className="h-screen flex flex-col">
      <Header modelStatus={status} currentVariant={currentVariant} />

      {status !== "ready" && status !== "generating" ? (
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
      ) : (
        <>
          <Chat
            messages={messages}
            streamingOutput={output}
            isGenerating={isGenerating}
            stats={stats}
          />
          <InputBar
            onSend={handleSend}
            onInterrupt={interrupt}
            isGenerating={isGenerating}
            disabled={status !== "ready" && status !== "generating"}
          />
        </>
      )}
    </div>
  );
}
