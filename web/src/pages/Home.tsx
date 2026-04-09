import { Link } from "react-router-dom";
import { Header } from "../components/Header";
import { FeatureCard } from "../components/FeatureCard";
import { WebGPUBadge } from "../components/WebGPUBadge";

export function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero with Onix */}
        <section className="max-w-5xl mx-auto px-4 pt-12 pb-16">
          <div className="relative rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 to-neutral-900 overflow-hidden">
            <div className="flex flex-col items-center gap-6 px-4 py-6 md:flex-row md:gap-8 md:px-10 md:py-10">
              {/* Onix image */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-3xl scale-110" />
                <img
                  src={`${import.meta.env.BASE_URL}onix.webp`}
                  alt="Shiny Onix"
                  className="relative w-32 h-32 md:w-48 md:h-48 object-contain drop-shadow-[0_0_30px_rgba(129,140,248,0.3)]"
                />
              </div>

              {/* Text content */}
              <div className="space-y-4 text-center md:text-left">
                <h1 className="text-3xl font-bold tracking-tight md:text-5xl">onyx</h1>
                <p className="text-lg text-neutral-400">
                  Gemma 4 in your browser
                </p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {["WebGPU", "Multimodal", "On-device", "Arena", "E2B", "E4B", "ONNX q4"].map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 text-xs font-mono rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom accent */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-60" />
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-4 pb-12 text-center space-y-6">
          <p className="text-sm text-neutral-500">
            No API keys. No server. No data leaving your machine.
          </p>

          <WebGPUBadge />

          <div className="flex gap-3 justify-center">
            <Link
              to="/playground"
              className="px-6 py-3 bg-white text-black rounded-xl font-medium hover:bg-neutral-200 transition-colors"
            >
              Open Playground
            </Link>
            <Link
              to="/arena"
              className="px-6 py-3 bg-neutral-800 text-white rounded-xl font-medium hover:bg-neutral-700 transition-colors border border-neutral-700"
            >
              Try Arena
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FeatureCard
              title="Multimodal Chat"
              description="Text, images, and audio. Gemma 4 E2B handles all three modalities right in your browser tab."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
              }
            />
            <FeatureCard
              title="E2B vs E4B Arena"
              description="Run the same prompt through both models sequentially. Compare speed, quality, and token stats side by side."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              }
            />
            <FeatureCard
              title="Open Source Toolkit"
              description="Python scripts to convert, validate, and benchmark any Gemma 4 variant to browser-ready ONNX format."
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Tech info */}
        <section className="max-w-4xl mx-auto px-4 pb-20">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-neutral-400">
              <div>
                <h3 className="text-white font-medium mb-1">Models</h3>
                <p>Gemma 4 E2B (~3.2 GB) and E4B (~5 GB), quantized to 4-bit (q4f16) in ONNX format with vision + audio encoders. Downloaded once, cached in your browser.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Runtime</h3>
                <p>Transformers.js with WebGPU acceleration. Inference runs in a Web Worker so the UI stays smooth. ~20-25 tok/s on Apple Silicon.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Privacy</h3>
                <p>Everything runs locally. Your prompts, images, and audio never leave your device. No API keys, no accounts, no telemetry.</p>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Requirements</h3>
                <p>Chrome 113+ or Edge 113+ with WebGPU. At least 4 GB GPU memory for E2B, 8 GB for E4B.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-800 py-6 text-center text-xs text-neutral-500">
        <p>
          Built with Transformers.js and WebGPU. Models by Google DeepMind.{" "}
          <a
            href="https://github.com/sacredvoid/onyx"
            className="text-neutral-400 hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
