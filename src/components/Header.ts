export function renderHeader(dark: boolean, onToggle: () => void): HTMLElement {
  const container = document.createElement("div");
  container.className = "flex items-center justify-between";

  container.innerHTML = `
    <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">
      TypeRacer Stats
      <a
        href="https://github.com/SirMasterMind1379/typeracer-stats/releases"
        target="_blank"
        rel="noopener noreferrer"
        class="ml-2 text-xs font-normal text-beige-600 dark:text-beige-400 hover:text-beige-800 dark:hover:text-beige-200 align-baseline"
      >
        v2.0.0
      </a>
    </h1>
    <div class="flex items-center gap-2">
      <a
        href="https://github.com/SirMasterMind1379/typeracer-stats"
        target="_blank"
        rel="noopener noreferrer"
        class="p-2 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100"
        aria-label="GitHub repository"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
      </a>
      <button
        id="theme-toggle-btn"
        class="p-2 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 cursor-pointer"
        aria-label="Toggle theme"
      >
        ${
          dark
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`
        }
      </button>
    </div>
  `;

  container.querySelector("#theme-toggle-btn")?.addEventListener("click", onToggle);

  return container;
}
