import { Sun, Moon, GitBranch } from "lucide-react";

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
      </h1>
      <div className="flex items-center gap-2">
        <a
          href="https://github.com/SirMasterMind1379/typeracer-stats"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-800 hover:bg-beige-200 dark:hover:bg-zinc-700"
          aria-label="GitHub repository"
        >
          <GitBranch size={20} />
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
