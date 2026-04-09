import { useState } from "react";
import type { ProgressInfo, ModelVariant } from "../lib/types";
import { progressPercent } from "../lib/types";
import { formatBytes } from "../lib/utils";
import { isMobileDevice } from "../lib/webgpu";

interface ModelLoaderProps {
  variant: ModelVariant;
  progress: ProgressInfo | null;
  onLoad: (variant: ModelVariant) => void;
  isLoading: boolean;
  isReady: boolean;
}

export function ModelLoader({
  variant,
  progress,
  onLoad,
  isLoading,
  isReady,
}: ModelLoaderProps) {
  const [mobile] = useState(() => isMobileDevice());
  const [mobileAcknowledged, setMobileAcknowledged] = useState(false);

  if (isReady) return null;

  const percent = progress ? progressPercent(progress) : 0;

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      {isLoading ? (
        <div className="w-full max-w-md space-y-3">
          <div className="flex justify-between text-sm text-neutral-400">
            <span>Loading {variant} model...</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          {progress && (
            <p className="text-xs text-neutral-500 font-mono truncate">
              {progress.file} - {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </p>
          )}
        </div>
      ) : mobile && !mobileAcknowledged ? (
        <div className="text-center space-y-4 max-w-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            Mobile device detected
          </div>
          <p className="text-neutral-400 text-sm">
            Onyx runs large AI models ({variant === "E2B" ? "~3.2 GB" : "~5 GB"}) directly on your GPU.
            Mobile devices often lack the memory required and may crash or freeze.
          </p>
          <p className="text-neutral-500 text-xs">
            For the best experience, use a desktop or laptop with a dedicated GPU.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setMobileAcknowledged(true)}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
            >
              Try anyway
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <p className="text-neutral-400">
            Load the Gemma 4 {variant} model to start chatting.
            {variant === "E2B" ? " (~3.2 GB total)" : " (~5 GB total)"}
          </p>
          {mobile && (
            <p className="text-xs text-yellow-400/80">
              Mobile device — performance may be limited or unstable
            </p>
          )}
          <button
            onClick={() => onLoad(variant)}
            className="px-6 py-2.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
          >
            Load {variant} Model
          </button>
        </div>
      )}
    </div>
  );
}
