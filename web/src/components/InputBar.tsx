import { useState, useRef, type KeyboardEvent } from "react";
import { cn } from "../lib/utils";

interface InputBarProps {
  onSend: (text: string, image?: File, audio?: Blob) => void;
  onInterrupt?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  placeholder?: string;
  onError?: (message: string) => void;
}

export function InputBar({
  onSend,
  onInterrupt,
  disabled,
  isGenerating,
  placeholder = "Type a message...",
  onError,
}: InputBarProps) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleSend = () => {
    if ((!text.trim() && !imageFile && !audioBlob) || disabled) return;
    onSend(text.trim(), imageFile ?? undefined, audioBlob ?? undefined);
    setText("");
    setImageFile(null);
    setImagePreview(null);
    setAudioBlob(null);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.onerror = () => {
      setImageFile(null);
      onError?.("Failed to read the selected image file.");
    };
    reader.readAsDataURL(file);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access denied. Check your browser permissions."
          : e instanceof DOMException && e.name === "NotFoundError"
            ? "No microphone found on this device."
            : "Could not access microphone.";
      onError?.(msg);
    }
  };

  return (
    <div className="bg-neutral-950 p-4">
      {(imagePreview || audioBlob) && (
        <div className="flex gap-2 mb-3">
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="preview" className="h-16 rounded-lg object-cover" />
              <button
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center"
              >
                x
              </button>
            </div>
          )}
          {audioBlob && (
            <div className="relative flex items-center gap-2 bg-neutral-800 rounded-lg px-3 py-1">
              <span className="text-xs text-neutral-400">Audio recorded</span>
              <button
                onClick={() => setAudioBlob(null)}
                className="w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center"
              >
                x
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <button onClick={() => imageInputRef.current?.click()} className="p-2 text-neutral-400 hover:text-white transition-colors" title="Upload image">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
          </svg>
        </button>

        <button onClick={toggleRecording} className={cn("p-2 transition-colors", isRecording ? "text-red-500 animate-pulse" : "text-neutral-400 hover:text-white")} title={isRecording ? "Stop recording" : "Record audio"}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
          </svg>
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 disabled:opacity-50"
        />

        {isGenerating ? (
          <button onClick={onInterrupt} className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
            Stop
          </button>
        ) : (
          <button onClick={handleSend} disabled={disabled || (!text.trim() && !imageFile && !audioBlob)} className="px-4 py-2.5 bg-white text-black rounded-xl text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Send
          </button>
        )}
      </div>
    </div>
  );
}
