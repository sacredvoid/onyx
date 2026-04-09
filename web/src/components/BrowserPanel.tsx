import { forwardRef, useState, useRef, type KeyboardEvent } from "react";
import { cn } from "../lib/utils";

interface BrowserPanelProps {
  url: string;
  onNavigate: (url: string) => void;
}

export const BrowserPanel = forwardRef<HTMLIFrameElement, BrowserPanelProps>(
  function BrowserPanel({ url, onNavigate }, ref) {
    const [inputUrl, setInputUrl] = useState(url);
    const [isLoading, setIsLoading] = useState(false);
    const internalIframeRef = useRef<HTMLIFrameElement | null>(null);

    // Sync input URL when the prop changes (React-recommended derived state pattern)
    const [prevUrl, setPrevUrl] = useState(url);
    if (url !== prevUrl) {
      setPrevUrl(url);
      setInputUrl(url);
    }

    const handleGo = () => {
      const trimmed = inputUrl.trim();
      if (!trimmed) return;
      const fullUrl =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      setInputUrl(fullUrl);
      onNavigate(fullUrl);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") handleGo();
    };

    // Combine forwarded ref with internal ref
    const setRefs = (el: HTMLIFrameElement | null) => {
      internalIframeRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLIFrameElement | null>).current = el;
    };

    return (
      <div className="flex flex-col h-full bg-neutral-950 border-l border-neutral-800">
        {/* URL bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const iframe = internalIframeRef.current;
                if (iframe) {
                  try { iframe.contentWindow?.history.back(); } catch { /* cross-origin */ }
                }
              }}
              className="p-1 text-neutral-500 hover:text-white transition-colors"
              title="Back"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => {
                const iframe = internalIframeRef.current;
                if (iframe) {
                  try {
                    iframe.contentWindow?.location.reload();
                  } catch {
                    // Cross-origin fallback: re-navigate
                    const currentSrc = iframe.src;
                    iframe.src = "about:blank";
                    setTimeout(() => { iframe.src = currentSrc; }, 0);
                  }
                }
              }}
              className="p-1 text-neutral-500 hover:text-white transition-colors"
              title="Reload"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
              </svg>
            </button>
          </div>

          <div className="flex-1 flex items-center bg-neutral-800 rounded-lg overflow-hidden">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter URL..."
              className="flex-1 bg-transparent px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none font-mono"
            />
            {isLoading && (
              <div className="pr-2">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <button
            onClick={handleGo}
            className="px-2 py-1 text-xs bg-neutral-800 text-neutral-300 rounded-md hover:bg-neutral-700 hover:text-white transition-colors"
          >
            Go
          </button>
        </div>

        {/* Iframe container */}
        <div className="flex-1 relative">
          {!url ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500 text-sm gap-3">
              <svg className="w-12 h-12 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <p>Ask the AI to navigate somewhere</p>
              <p className="text-xs text-neutral-600">
                or try the built-in demo page
              </p>
            </div>
          ) : (
            <iframe
              ref={setRefs}
              src={url}
              className={cn(
                "absolute inset-0 w-full h-full bg-white",
                isLoading && "opacity-50",
              )}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              onLoad={() => setIsLoading(false)}
              onLoadStart={() => setIsLoading(true)}
              title="Browser"
            />
          )}
        </div>
      </div>
    );
  },
);
