import type { ProgressInfo, ModelVariant } from "../lib/types";
import { formatBytes } from "../lib/utils";

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
  if (isReady) return null;

  const percent = progress
    ? Math.round((progress.loaded / progress.total) * 100)
    : 0;

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
      ) : (
        <div className="text-center space-y-4">
          <p className="text-neutral-400">
            Load the Gemma 4 {variant} model to start chatting.
            {variant === "E2B" ? " (~500 MB)" : " (~1.5 GB)"}
          </p>
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
