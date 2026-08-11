import type { Race } from "../types";
import { formatDisplayDate } from "../types";

export interface UniqueQuoteStats {
  textId: number;
  count: number;
  bestWpm: number;
  avgWpm: number;
  lastTyped: string;
  bestAccuracy: number;
}

export function aggregateTextCollector(races: Race[]): UniqueQuoteStats[] {
  const map = new Map<number, Race[]>();

  for (const r of races) {
    if (r.textId == null || r.textId <= 0) continue;
    const existing = map.get(r.textId) || [];
    existing.push(r);
    map.set(r.textId, existing);
  }

  const result: UniqueQuoteStats[] = [];

  map.forEach((raceList, textId) => {
    const count = raceList.length;
    const speeds = raceList.map((r) => r.speed);
    const accuracies = raceList.map((r) => r.accuracy);
    const bestWpm = Math.max(...speeds, 0);
    const avgWpm = +(speeds.reduce((a, b) => a + b, 0) / count).toFixed(1);
    const bestAccuracy = Math.max(...accuracies, 0);

    // Sort by date descending to find last typed
    const sorted = [...raceList].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const lastTyped = sorted[0].date;

    result.push({
      textId,
      count,
      bestWpm,
      avgWpm,
      lastTyped,
      bestAccuracy,
    });
  });

  return result;
}

type SortOption = "id_asc" | "id_desc" | "best_wpm" | "count" | "recent";

export function renderTextCollector(races: Race[]): HTMLElement {
  const container = document.createElement("div");
  container.className =
    "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4 sm:p-5 flex flex-col gap-4 text-beige-900 dark:text-beige-100";

  const allQuotes = aggregateTextCollector(races);
  const totalUnique = allQuotes.length;

  let filterSearch = "";
  let currentSort: SortOption = "recent";
  let filterRepeat: "all" | "single" | "multi" = "all";
  let pageSize = 60;
  let currentPage = 1;
  let selectedQuoteId: number | null = null;

  function getProcessedQuotes(): UniqueQuoteStats[] {
    let list = [...allQuotes];

    if (filterSearch.trim()) {
      const q = filterSearch.trim();
      list = list.filter((item) => String(item.textId).includes(q));
    }

    if (filterRepeat === "single") {
      list = list.filter((item) => item.count === 1);
    } else if (filterRepeat === "multi") {
      list = list.filter((item) => item.count > 1);
    }

    list.sort((a, b) => {
      if (currentSort === "id_asc") return a.textId - b.textId;
      if (currentSort === "id_desc") return b.textId - a.textId;
      if (currentSort === "best_wpm") return b.bestWpm - a.bestWpm;
      if (currentSort === "count") return b.count - a.count;
      if (currentSort === "recent") {
        return new Date(b.lastTyped).getTime() - new Date(a.lastTyped).getTime();
      }
      return 0;
    });

    return list;
  }

  function update() {
    const processed = getProcessedQuotes();
    const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const pageItems = processed.slice(0, currentPage * pageSize);

    const overallAvgWpm = totalUnique
      ? (allQuotes.reduce((s, q) => s + q.bestWpm, 0) / totalUnique).toFixed(1)
      : "0.0";
    const overallPeakWpm = totalUnique
      ? Math.max(...allQuotes.map((q) => q.bestWpm), 0).toFixed(1)
      : "0.0";

    container.innerHTML = `
      <!-- Header & Progress Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-beige-300 dark:border-beige-800 pb-3">
        <div>
          <h3 class="text-base font-bold text-beige-900 dark:text-beige-100 flex items-center gap-2 uppercase tracking-wide">
            <span>🎮</span> TEXT COLLECTOR ("CATCH 'EM ALL")
          </h3>
          <p class="text-xs text-beige-600 dark:text-beige-400 mt-0.5 font-mono">
            Track and collect unique TypeRacer quote text IDs completed across your races
          </p>
        </div>

        <div class="flex items-center gap-3 font-mono text-xs">
          <div class="bg-beige-200 dark:bg-beige-800 px-3 py-1.5 border border-beige-300 dark:border-beige-700 text-center">
            <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Collected</span>
            <span class="text-sm font-bold text-red-900 dark:text-red-400">${totalUnique}</span>
            <span class="text-[10px] text-beige-600 dark:text-beige-400">Unique Quotes</span>
          </div>
          <div class="bg-beige-200 dark:bg-beige-800 px-3 py-1.5 border border-beige-300 dark:border-beige-700 text-center">
            <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Avg Best WPM</span>
            <span class="text-sm font-bold text-beige-900 dark:text-beige-100">${overallAvgWpm}</span>
          </div>
          <div class="bg-beige-200 dark:bg-beige-800 px-3 py-1.5 border border-beige-300 dark:border-beige-700 text-center">
            <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Peak Speed</span>
            <span class="text-sm font-bold text-amber-600 dark:text-amber-400">${overallPeakWpm} WPM</span>
          </div>
        </div>
      </div>

      <!-- Controls Row: Search & Filters -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 flex-wrap">
          <input
            id="text-search-input"
            type="text"
            placeholder="Search Text ID (e.g. 3628)..."
            value="${escapeHtml(filterSearch)}"
            class="px-3 py-1.5 text-xs bg-beige-50 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100 focus:outline-none focus:border-red-900 dark:focus:border-red-500 font-mono w-56"
          />

          <div class="flex items-center gap-1 border border-beige-300 dark:border-beige-700 p-0.5 bg-beige-50 dark:bg-beige-800">
            <button
              id="filter-repeat-all"
              class="px-2 py-1 text-xs font-medium cursor-pointer ${
                filterRepeat === "all"
                  ? "bg-red-900 text-beige-50 font-bold"
                  : "text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-700"
              }"
            >
              All (${totalUnique})
            </button>
            <button
              id="filter-repeat-single"
              class="px-2 py-1 text-xs font-medium cursor-pointer ${
                filterRepeat === "single"
                  ? "bg-red-900 text-beige-50 font-bold"
                  : "text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-700"
              }"
            >
              1x Only
            </button>
            <button
              id="filter-repeat-multi"
              class="px-2 py-1 text-xs font-medium cursor-pointer ${
                filterRepeat === "multi"
                  ? "bg-red-900 text-beige-50 font-bold"
                  : "text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-700"
              }"
            >
              2x+ Repeat
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2 font-mono text-xs">
          <span class="text-beige-600 dark:text-beige-400">Sort by:</span>
          <select
            id="sort-select"
            class="px-2 py-1 bg-beige-50 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100 focus:outline-none"
          >
            <option value="recent" ${currentSort === "recent" ? "selected" : ""}>Most Recent</option>
            <option value="best_wpm" ${currentSort === "best_wpm" ? "selected" : ""}>Highest WPM</option>
            <option value="count" ${currentSort === "count" ? "selected" : ""}>Most Repeated</option>
            <option value="id_asc" ${currentSort === "id_asc" ? "selected" : ""}>Text ID (Ascending)</option>
            <option value="id_desc" ${currentSort === "id_desc" ? "selected" : ""}>Text ID (Descending)</option>
          </select>
        </div>
      </div>

      <!-- Quote Matrix Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 my-1">
        ${
          pageItems.length === 0
            ? `<div class="col-span-full py-8 text-center text-xs text-beige-600 dark:text-beige-400 italic">
                No matching quote text IDs found. Try a different search term.
              </div>`
            : pageItems
                .map((q) => {
                  const isSelected = selectedQuoteId === q.textId;
                  return `
            <div
              data-text-id="${q.textId}"
              class="bg-beige-200/60 dark:bg-beige-800/60 border ${
                isSelected
                  ? "border-red-900 dark:border-red-500 ring-1 ring-red-900 dark:ring-red-500"
                  : "border-beige-300 dark:border-beige-700 hover:border-red-900/50 dark:hover:border-red-500/50"
              } p-2.5 flex flex-col justify-between transition-all cursor-pointer select-none group"
            >
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-mono font-bold text-beige-900 dark:text-beige-100 flex items-center gap-1">
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold">✓</span> #${q.textId}
                </span>
                ${
                  q.count > 1
                    ? `<span class="px-1 py-0.2 text-[9px] font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-700">
                        ${q.count}x
                      </span>`
                    : `<span class="text-[9px] font-mono text-beige-500 dark:text-beige-400">1x</span>`
                }
              </div>

              <div class="flex items-baseline justify-between mt-1 font-mono">
                <span class="text-xs font-bold text-red-900 dark:text-red-400">
                  ${q.bestWpm.toFixed(1)} <span class="text-[9px] font-normal text-beige-600 dark:text-beige-400">WPM</span>
                </span>
                <span class="text-[9px] text-beige-600 dark:text-beige-400">
                  ${formatDisplayDate(q.lastTyped)}
                </span>
              </div>
            </div>
          `;
                })
                .join("")
        }
      </div>

      <!-- Detail Drawer when a Quote Card is selected -->
      ${
        selectedQuoteId !== null
          ? renderQuoteDetail(allQuotes.find((q) => q.textId === selectedQuoteId))
          : ""
      }

      <!-- Pagination / Show More Row -->
      <div class="flex items-center justify-between text-xs font-mono text-beige-600 dark:text-beige-400 border-t border-beige-300 dark:border-beige-800 pt-3">
        <span>Showing ${pageItems.length} of ${processed.length} unique quotes</span>
        ${
          processed.length > pageItems.length
            ? `<button
                id="btn-show-more-quotes"
                class="px-4 py-1.5 bg-red-900 hover:bg-red-800 text-beige-50 text-xs font-medium border border-red-900 cursor-pointer"
              >
                Load More Quotes (+60)
              </button>`
            : pageItems.length > 60
            ? `<button
                id="btn-show-less-quotes"
                class="px-3 py-1 bg-beige-200 dark:bg-beige-800 hover:bg-beige-300 dark:hover:bg-beige-700 text-beige-800 dark:text-beige-200 text-xs font-medium border border-beige-300 dark:border-beige-700 cursor-pointer"
              >
                Show Less
              </button>`
            : ""
        }
      </div>
    `;

    // Event Listeners
    const searchInput = container.querySelector("#text-search-input") as HTMLInputElement;
    searchInput?.addEventListener("input", (e) => {
      filterSearch = (e.target as HTMLInputElement).value;
      currentPage = 1;
      update();
    });

    const sortSelect = container.querySelector("#sort-select") as HTMLSelectElement;
    sortSelect?.addEventListener("change", (e) => {
      currentSort = (e.target as HTMLSelectElement).value as SortOption;
      update();
    });

    container.querySelector("#filter-repeat-all")?.addEventListener("click", () => {
      filterRepeat = "all";
      currentPage = 1;
      update();
    });

    container.querySelector("#filter-repeat-single")?.addEventListener("click", () => {
      filterRepeat = "single";
      currentPage = 1;
      update();
    });

    container.querySelector("#filter-repeat-multi")?.addEventListener("click", () => {
      filterRepeat = "multi";
      currentPage = 1;
      update();
    });

    container.querySelectorAll("div[data-text-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const tid = parseInt(card.getAttribute("data-text-id")!, 10);
        selectedQuoteId = selectedQuoteId === tid ? null : tid;
        update();
      });
    });

    container.querySelector("#btn-show-more-quotes")?.addEventListener("click", () => {
      pageSize += 60;
      update();
    });

    container.querySelector("#btn-show-less-quotes")?.addEventListener("click", () => {
      pageSize = 60;
      update();
    });
  }

  update();
  return container;
}

function renderQuoteDetail(quote?: UniqueQuoteStats): string {
  if (!quote) return "";
  return `
    <div class="bg-beige-50 dark:bg-beige-950 border border-red-900/60 dark:border-red-500/60 p-3.5 flex flex-col gap-2 font-mono my-1 animate-fadeIn">
      <div class="flex items-center justify-between">
        <span class="text-sm font-bold text-beige-900 dark:text-beige-100 flex items-center gap-1.5">
          <span class="text-emerald-600 dark:text-emerald-400">✓</span> Text #${quote.textId} Breakdown
        </span>
        <a
          href="https://data.typeracer.com/pit/text_info?info_retry=1&text_id=${quote.textId}"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-red-900 dark:text-red-400 underline hover:text-red-700 dark:hover:text-red-300"
        >
          View Quote on TypeRacer ↗
        </a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1 border-t border-beige-300 dark:border-beige-800">
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Times Completed</span>
          <span class="font-bold text-beige-900 dark:text-beige-100 text-sm">${quote.count} ${quote.count === 1 ? "time" : "times"}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Peak Speed</span>
          <span class="font-bold text-red-900 dark:text-red-400 text-sm">${quote.bestWpm.toFixed(1)} WPM</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Avg Speed</span>
          <span class="font-bold text-beige-900 dark:text-beige-100 text-sm">${quote.avgWpm.toFixed(1)} WPM</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block">Last Completed</span>
          <span class="font-bold text-beige-900 dark:text-beige-100 text-sm">${formatDisplayDate(quote.lastTyped)}</span>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
