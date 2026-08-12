export type ThemeMode = "auto" | "light" | "dark";

export function renderHeader(themeMode: ThemeMode, resolvedDark: boolean, onToggle: () => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "flex items-center justify-between";

  const getThemeIconAndLabel = () => {
    if (themeMode === "auto") {
      return `
        <span class="flex items-center gap-1.5 text-xs font-mono font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
          AUTO (${resolvedDark ? "DARK" : "LIGHT"})
        </span>
      `;
    }
    if (themeMode === "light") {
      return `
        <span class="flex items-center gap-1.5 text-xs font-mono font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          LIGHT
        </span>
      `;
    }
    return `
      <span class="flex items-center gap-1.5 text-xs font-mono font-bold">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        DARK
      </span>
    `;
  };

  container.innerHTML = `
    <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
      TypeRacer Stats
      <a
        href="https://github.com/SirMasterMind1379/typeracer-stats/releases"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-2 text-xs font-normal text-beige-600 dark:text-beige-400 hover:text-beige-800 dark:hover:text-beige-200 align-baseline"
      >
        v2.2.0
      </a>
    </h1>
    <div class="flex items-center gap-2">
      <a
        href="https://github.com/SirMasterMind1379/typeracer-stats"
        target="_blank"
        rel="noopener noreferrer"
        class="h-[38px] p-2 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 flex items-center justify-center"
        aria-label="GitHub repository"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
      </a>
      <button
        id="theme-toggle-btn"
        class="h-[38px] px-2.5 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 cursor-pointer transition-all flex items-center justify-center"
        title="Theme Mode: ${themeMode.toUpperCase()} (Click to cycle Auto -> Light -> Dark)"
        aria-label="Toggle theme mode"
      >
        ${getThemeIconAndLabel()}
      </button>
    </div>
  `;

  container.querySelector("#theme-toggle-btn")?.addEventListener("click", onToggle);

  return container;
}
