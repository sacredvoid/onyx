export type WebGPUStatus =
  | { supported: true; adapterName: string; isMobile: boolean }
  | { supported: false; error: string; isMobile: boolean };

/** Detect if the device is likely a mobile phone or tablet */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) ||
    ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 2 && /Macintosh/.test(ua));
}

export async function checkWebGPU(): Promise<WebGPUStatus> {
  const mobile = isMobileDevice();

  if (!navigator.gpu) {
    return {
      supported: false,
      isMobile: mobile,
      error: mobile
        ? "WebGPU is not supported on this mobile browser. Onyx requires a desktop browser with WebGPU (Chrome 113+ or Edge 113+)."
        : "WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.",
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        isMobile: mobile,
        error: mobile
          ? "No compatible GPU found. Mobile devices typically lack the GPU memory needed for on-device LLMs (3-5 GB required)."
          : "No WebGPU adapter found. Your GPU may not be supported.",
      };
    }

    const info = adapter.info ?? (adapter as unknown as { requestAdapterInfo?: () => GPUAdapterInfo }).requestAdapterInfo?.();
    const resolved = info instanceof Promise ? await info : info;
    return {
      supported: true,
      isMobile: mobile,
      adapterName: resolved?.device || resolved?.description || "Unknown GPU",
    };
  } catch (e) {
    return {
      supported: false,
      isMobile: mobile,
      error: `WebGPU check failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
