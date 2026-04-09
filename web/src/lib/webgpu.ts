export type WebGPUStatus =
  | { supported: true; adapterName: string }
  | { supported: false; error: string };

export async function checkWebGPU(): Promise<WebGPUStatus> {
  if (!navigator.gpu) {
    return {
      supported: false,
      error: "WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.",
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: "No WebGPU adapter found. Your GPU may not be supported.",
      };
    }

    const info = adapter.info ?? (adapter as any).requestAdapterInfo?.();
    const resolved = info instanceof Promise ? await info : info;
    return {
      supported: true,
      adapterName: resolved?.device || resolved?.description || "Unknown GPU",
    };
  } catch (e) {
    return {
      supported: false,
      error: `WebGPU check failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
