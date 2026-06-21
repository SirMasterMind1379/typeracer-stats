import { Sun, Moon } from "lucide-react";

/**
 * Header — app title on the left, dark/light theme toggle on the right.
 *
 * @param dark   - Whether dark mode is active.
 * @param onToggle - Callback to toggle the theme.
 */
export default function Header({
  dark,
  onToggle,
}: {
  dark: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        TypeRacer Stats
        <a
          href="https://github.com/SirMasterMind1379/typeracer-stats/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-xs font-normal text-beige-500 dark:text-zinc-500 hover:text-beige-700 dark:hover:text-zinc-300 align-baseline"
        >
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </a>
      </h1>
      <div className="flex items-center gap-2">
        <a
          href="https://github.com/SirMasterMind1379/typeracer-stats"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-800 hover:bg-beige-200 dark:hover:bg-zinc-700"
          aria-label="GitHub repository"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        </a>
        <button
          onClick={onToggle}
          className="p-2 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-800 hover:bg-beige-200 dark:hover:bg-zinc-700"
          aria-label="Toggle theme"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
}
