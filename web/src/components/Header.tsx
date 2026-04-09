import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import type { ModelStatus, ModelVariant } from "../lib/types";

interface HeaderProps {
  modelStatus?: ModelStatus;
  currentVariant?: ModelVariant | null;
}

const NAV_ITEMS = [
  { path: "/", label: "Home" },
  { path: "/playground", label: "Playground" },
  { path: "/arena", label: "Arena" },
];

export function Header({ modelStatus, currentVariant }: HeaderProps) {
  const location = useLocation();

  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight">onyx</span>
          <span className="text-xs text-neutral-500 font-mono">gemma 4</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                location.pathname === path
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/50",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 text-xs">
          {currentVariant && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono">
              {currentVariant}
            </span>
          )}
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              modelStatus === "ready" && "bg-green-500",
              modelStatus === "loading" && "bg-yellow-500 animate-pulse",
              modelStatus === "generating" && "bg-blue-500 animate-pulse",
              modelStatus === "error" && "bg-red-500",
              (!modelStatus || modelStatus === "idle") && "bg-neutral-600",
            )}
          />
        </div>
      </div>
    </header>
  );
}
