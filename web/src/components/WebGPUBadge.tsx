import { useEffect, useState } from "react";
import { checkWebGPU, type WebGPUStatus } from "../lib/webgpu";

export function WebGPUBadge() {
  const [status, setStatus] = useState<WebGPUStatus | null>(null);

  useEffect(() => {
    checkWebGPU().then(setStatus);
  }, []);

  if (!status) return null;

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        status.supported
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-red-500/10 text-red-400 border border-red-500/20"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          status.supported ? "bg-green-500" : "bg-red-500"
        }`}
      />
      {status.supported
        ? `WebGPU ready - ${status.adapterName}`
        : status.error}
    </div>
  );
}
