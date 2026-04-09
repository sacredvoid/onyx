export interface WebGPUStatus {
  supported: boolean;
  adapterName?: string;
  error?: string;
}

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

    const info = await adapter.requestAdapterInfo();
    return {
      supported: true,
      adapterName: info.device || info.description || "Unknown GPU",
    };
  } catch (e) {
    return {
      supported: false,
      error: `WebGPU check failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
