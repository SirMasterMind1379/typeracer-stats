import type { Race } from "../types";
import { formatDisplayDate, escapeHtml } from "../types";

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

type SortOption = "id_asc" | "id_desc" | "best_wpm" | "avg_wpm" | "count" | "recent";

export interface TextCollectorState {
  isPokedexView: boolean;
  selectedQuoteId: number | null;
  filterSearch: string;
  currentSort: SortOption;
  filterRepeat: "all" | "single" | "multi";
  pageSize: number;
}

export function renderTextCollector(races: Race[], state?: TextCollectorState): HTMLElement {
  const container = document.createElement("div");
  container.className =
    "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4 sm:p-5 flex flex-col gap-4 text-beige-900 dark:text-beige-100";

  const allQuotes = aggregateTextCollector(races);
  const totalUnique = allQuotes.length;

  // Use state or initialize defaults
  const currentState: TextCollectorState = state || {
    isPokedexView: false,
    selectedQuoteId: null,
    filterSearch: "",
    currentSort: "recent",
    filterRepeat: "all",
    pageSize: 30,
  };

  function getProcessedQuotes(): UniqueQuoteStats[] {
    let list = [...allQuotes];

    if (currentState.filterSearch.trim()) {
      const q = currentState.filterSearch.trim();
      list = list.filter((item) => String(item.textId).includes(q));
    }

    if (currentState.filterRepeat === "single") {
      list = list.filter((item) => item.count === 1);
    } else if (currentState.filterRepeat === "multi") {
      list = list.filter((item) => item.count > 1);
    }

    list.sort((a, b) => {
      if (currentState.currentSort === "id_asc") return a.textId - b.textId;
      if (currentState.currentSort === "id_desc") return b.textId - a.textId;
      if (currentState.currentSort === "best_wpm") return b.bestWpm - a.bestWpm;
      if (currentState.currentSort === "avg_wpm") return b.avgWpm - a.avgWpm;
      if (currentState.currentSort === "count") return b.count - a.count;
      if (currentState.currentSort === "recent") {
        return new Date(b.lastTyped).getTime() - new Date(a.lastTyped).getTime();
      }
      return 0;
    });

    return list;
  }

  function update() {
    const processed = getProcessedQuotes();
    const totalPages = Math.max(1, Math.ceil(processed.length / currentState.pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const pageItems = processed.slice(0, currentPage * currentState.pageSize);

    // Calculate upper bound ID range for unconquered stats
    const encounteredIds = allQuotes.map((q) => q.textId);
    const maxEncountered = encounteredIds.length ? Math.max(...encounteredIds) : 1000;
    const maxSpectrumRange = Math.min(Math.max(maxEncountered, 1000), 5000);
    const unconqueredCount = maxSpectrumRange - totalUnique;

    container.innerHTML = `
      <!-- Centered Header Banner -->
      <div class="text-center border-b border-beige-300 dark:border-beige-800 pb-3">
        <h3 class="text-base sm:text-lg font-bold text-beige-900 dark:text-beige-100 flex items-center justify-center gap-2 uppercase tracking-wide">
          <span>🎮</span> TEXT COLLECTOR ("CATCH 'EM ALL")
        </h3>
        <p class="text-xs text-beige-600 dark:text-beige-400 mt-1 font-mono">
          Track and collect unique TypeRacer quote text IDs completed across your races
        </p>
      </div>

      <!-- Top Banners Row: Full Width Lower Height Boxes -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full font-mono my-1">
        <!-- Collected Counter Box -->
        <div class="bg-beige-200 dark:bg-beige-800 py-2 px-3 border border-beige-300 dark:border-beige-700 flex flex-col items-center justify-center text-center shadow-xs">
          <span class="text-[11px] uppercase text-beige-600 dark:text-beige-400 font-sans tracking-wide">Collected Status</span>
          <span class="text-sm sm:text-base font-bold text-red-900 dark:text-red-400 mt-0.5">${totalUnique} / ${unconqueredCount} Unconquered</span>
        </div>

        <!-- Pokédex View Toggle Button -->
        <button
          id="btn-pokedex-toggle"
          class="py-2 px-3 text-xs font-mono font-bold cursor-pointer transition-all border flex flex-col items-center justify-center text-center shadow-xs ${
            currentState.isPokedexView
              ? "bg-red-900 text-beige-50 border-red-900 ring-1 ring-red-900"
              : "bg-beige-200 dark:bg-beige-800 hover:bg-beige-300 dark:hover:bg-beige-700 text-beige-900 dark:text-beige-100 border-beige-300 dark:border-beige-700"
          }"
        >
          <span class="text-xs font-bold">🕹️ POKÉDEX VIEW ${currentState.isPokedexView ? "✓" : ""}</span>
        </button>
      </div>

      <!-- Controls Row: Search & Filters (Hidden in Pokédex View) -->
      ${
        currentState.isPokedexView
          ? ""
          : `
      <div class="flex flex-wrap items-center justify-center gap-3 w-full my-1">
        <input
          id="text-search-input"
          type="text"
          placeholder="Search Text ID (e.g. 3810697)..."
          value="${escapeHtml(currentState.filterSearch)}"
          class="px-3 py-1.5 text-xs bg-beige-50 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100 focus:outline-none focus:border-red-900 dark:focus:border-red-500 font-mono w-56 text-center"
        />

        <div class="flex items-center gap-1 border border-beige-300 dark:border-beige-700 p-0.5 bg-beige-50 dark:bg-beige-800 font-mono">
          <button
            id="filter-repeat-all"
            class="px-2.5 py-1 text-xs font-medium cursor-pointer ${
              currentState.filterRepeat === "all"
                ? "bg-red-900 text-beige-50 font-bold"
                : "text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-700"
            }"
          >
            All (${totalUnique})
          </button>
          <button
            id="filter-repeat-single"
            class="px-2.5 py-1 text-xs font-medium cursor-pointer ${
              currentState.filterRepeat === "single"
                ? "bg-red-900 text-beige-50 font-bold"
                : "text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-700"
            }"
          >
            1x Only
          </button>
          <button
            id="filter-repeat-multi"
            class="px-2.5 py-1 text-xs font-medium cursor-pointer ${
              currentState.filterRepeat === "multi"
                ? "bg-red-900 text-beige-50 font-bold"
                : "text-beige-700 dark:text-beige-300 hover:bg-beige-200 dark:hover:bg-beige-700"
            }"
          >
            2x+ Repeat
          </button>
        </div>

        <div class="flex items-center gap-2 font-mono text-xs">
          <span class="text-beige-600 dark:text-beige-400">Sort by:</span>
          <select
            id="sort-select"
            class="px-2 py-1 bg-beige-50 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100 focus:outline-none"
          >
            <option value="recent" ${currentState.currentSort === "recent" ? "selected" : ""}>Most Recent</option>
            <option value="best_wpm" ${currentState.currentSort === "best_wpm" ? "selected" : ""}>Highest Peak WPM</option>
            <option value="avg_wpm" ${currentState.currentSort === "avg_wpm" ? "selected" : ""}>Highest Average WPM</option>
            <option value="count" ${currentState.currentSort === "count" ? "selected" : ""}>Most Repeated</option>
            <option value="id_asc" ${currentState.currentSort === "id_asc" ? "selected" : ""}>Text ID (Ascending)</option>
            <option value="id_desc" ${currentState.currentSort === "id_desc" ? "selected" : ""}>Text ID (Descending)</option>
          </select>
        </div>
      </div>`
      }

      <!-- Quote Matrix Grid (Pokédex View vs Normal Card Grid) -->
      ${
        currentState.isPokedexView
          ? renderPokedexView(allQuotes, currentState.filterSearch)
          : renderNormalGrid(pageItems, currentState.selectedQuoteId)
      }

      <!-- Detail Drawer when a Quote Card is selected -->
      ${
        currentState.selectedQuoteId !== null
          ? renderQuoteDetail(
              allQuotes.find((q) => q.textId === currentState.selectedQuoteId),
              races
            )
          : ""
      }

      <!-- Pagination / Show More Row (Hidden in Pokédex View) -->
      ${
        currentState.isPokedexView
          ? ""
          : `
      <div class="flex items-center justify-between text-xs font-mono text-beige-600 dark:text-beige-400 border-t border-beige-300 dark:border-beige-800 pt-3">
        <span>Showing ${pageItems.length} of ${processed.length} unique quotes</span>
        ${
          processed.length > pageItems.length
            ? `<button
                id="btn-show-more-quotes"
                class="px-4 py-1.5 bg-red-900 hover:bg-red-800 text-beige-50 text-xs font-medium border border-red-900 cursor-pointer"
              >
                Load More Quotes (+30)
              </button>`
            : pageItems.length > 30
            ? `<button
                id="btn-show-less-quotes"
                class="px-3 py-1 bg-beige-200 dark:bg-beige-800 hover:bg-beige-300 dark:hover:bg-beige-700 text-beige-800 dark:text-beige-200 text-xs font-medium border border-beige-300 dark:border-beige-700 cursor-pointer"
              >
                Show Less
              </button>`
            : ""
        }
      </div>`
      }
    `;

    // Event Listeners
    container.querySelector("#btn-pokedex-toggle")?.addEventListener("click", () => {
      currentState.isPokedexView = !currentState.isPokedexView;
      update();
    });

    if (!currentState.isPokedexView) {
      const searchInput = container.querySelector("#text-search-input") as HTMLInputElement;
      searchInput?.addEventListener("input", (e) => {
        currentState.filterSearch = (e.target as HTMLInputElement).value;
        currentPage = 1;
        update();
      });

      const sortSelect = container.querySelector("#sort-select") as HTMLSelectElement;
      sortSelect?.addEventListener("change", (e) => {
        currentState.currentSort = (e.target as HTMLSelectElement).value as SortOption;
        update();
      });

      container.querySelector("#filter-repeat-all")?.addEventListener("click", () => {
        currentState.filterRepeat = "all";
        currentPage = 1;
        update();
      });

      container.querySelector("#filter-repeat-single")?.addEventListener("click", () => {
        currentState.filterRepeat = "single";
        currentPage = 1;
        update();
      });

      container.querySelector("#filter-repeat-multi")?.addEventListener("click", () => {
        currentState.filterRepeat = "multi";
        currentPage = 1;
        update();
      });

      container.querySelector("#btn-show-more-quotes")?.addEventListener("click", () => {
        currentState.pageSize += 30;
        update();
      });

      container.querySelector("#btn-show-less-quotes")?.addEventListener("click", () => {
        currentState.pageSize = 30;
        update();
      });
    }

    container.querySelectorAll("div[data-text-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const tid = parseInt(card.getAttribute("data-text-id")!, 10);
        currentState.selectedQuoteId = currentState.selectedQuoteId === tid ? null : tid;
        update();
      });
    });
  }

  let currentPage = 1;
  update();
  return container;
}

function renderNormalGrid(items: UniqueQuoteStats[], selectedQuoteId: number | null): string {
  if (items.length === 0) {
    return `<div class="col-span-full py-8 text-center text-xs text-beige-600 dark:text-beige-400 italic font-mono">
      No matching quote text IDs found. Try a different search term.
    </div>`;
  }

  return `
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 my-1 font-mono">
      ${items
        .map((q) => {
          const isSelected = selectedQuoteId === q.textId;
          return `
            <div
              data-text-id="${q.textId}"
              title="Text #${q.textId} - ${q.bestWpm.toFixed(1)} WPM (${q.count}x)"
              class="bg-beige-200/80 dark:bg-beige-800/80 border ${
                isSelected
                  ? "border-red-900 dark:border-red-500 ring-2 ring-red-900 dark:ring-red-500"
                  : "border-beige-300 dark:border-beige-700 hover:border-red-900/60 dark:hover:border-red-500/60"
              } p-3 flex flex-col justify-between cursor-pointer select-none transition-all shadow-xs"
            >
              <div class="flex items-center justify-between mb-2">
                <a
                  href="https://data.typeracer.com/pit/text_info?info_retry=1&id=${q.textId}"
                  target="_blank"
                  rel="noopener noreferrer"
                  onclick="event.stopPropagation()"
                  class="text-xs font-bold text-red-900 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                  title="Open Text #${q.textId} info on TypeRacer"
                >
                  #${q.textId}
                  <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                ${
                  q.count > 1
                    ? `<span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-700">${q.count}x</span>`
                    : `<span class="text-[10px] text-beige-500 dark:text-beige-400">1x</span>`
                }
              </div>
              <div class="flex items-baseline justify-between font-mono">
                <span class="text-sm font-bold text-red-900 dark:text-red-400">${q.bestWpm.toFixed(1)} <span class="text-[10px] font-normal text-beige-600 dark:text-beige-400">WPM</span></span>
                <span class="text-[10px] text-beige-600 dark:text-beige-400">${formatDisplayDate(q.lastTyped)}</span>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPokedexView(allQuotes: UniqueQuoteStats[], filterSearch: string): string {
  const map = new Map<number, UniqueQuoteStats>();
  allQuotes.forEach((q) => map.set(q.textId, q));

  const encounteredIds = [...map.keys()].sort((a, b) => a - b);
  if (encounteredIds.length === 0) {
    return `<div class="col-span-full py-8 text-center text-xs text-beige-600 dark:text-beige-400 italic font-mono">
      No quotes collected.
    </div>`;
  }

  const slots: { id: number; data?: UniqueQuoteStats }[] = [];
  const minId = 1;
  const maxEncountered = Math.max(...encounteredIds, 1);
  const maxId = Math.min(Math.max(maxEncountered, 1000), 5000);

  if (filterSearch.trim()) {
    const q = filterSearch.trim();
    const filtered = encounteredIds.filter((id) => String(id).includes(q));
    filtered.forEach((id) => slots.push({ id, data: map.get(id) }));
  } else {
    for (let id = minId; id <= maxId; id++) {
      slots.push({ id, data: map.get(id) });
    }
  }

  const conqueredCount = allQuotes.length;

  return `
    <div class="flex flex-col gap-2.5 font-mono my-1">
      <div class="flex items-center justify-between text-xs text-beige-600 dark:text-beige-400 border-b border-beige-300 dark:border-beige-800 pb-2">
        <span class="font-bold text-red-900 dark:text-red-400 uppercase tracking-wide flex items-center gap-1.5">
          <span>🕹️</span> POKÉDEX SPECTRUM MAP (RED = CONQUERED, GREY = UNCONQUERED)
        </span>
        <div class="flex items-center gap-3 text-[11px]">
          <span class="flex items-center gap-1"><span class="w-3 h-3 bg-red-900 dark:bg-red-700 inline-block"></span> Conquered (${conqueredCount})</span>
          <span class="flex items-center gap-1"><span class="w-3 h-3 bg-beige-300 dark:bg-beige-800 inline-block opacity-40"></span> Unconquered (${maxId - conqueredCount})</span>
        </div>
      </div>

      <!-- Ultra Compact w-3.5 h-3.5 Micro Square Grid (Strict Theme Match) -->
      <div class="flex flex-wrap gap-1 p-2 bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 max-h-96 overflow-y-auto custom-scrollbar">
        ${slots
          .map((slot) => {
            const q = slot.data;
            if (q) {
              return `
                <div
                  data-text-id="${q.textId}"
                  title="Text #${q.textId} | CONQUERED ✓ | Peak: ${q.bestWpm.toFixed(1)} WPM | Avg: ${q.avgWpm.toFixed(1)} WPM | Typed ${q.count}x"
                  class="w-3.5 h-3.5 bg-red-800 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 text-beige-50 flex items-center justify-center cursor-pointer select-none text-[5.5px] font-bold border border-red-900 dark:border-red-950 shadow-xs transition-transform hover:scale-125"
                >
                  ${q.textId > 999 ? String(q.textId).slice(-2) : q.textId}
                </div>
              `;
            } else {
              return `
                <div
                  title="Text #${slot.id} | UNCONQUERED ❌ (Not yet typed)"
                  class="w-3.5 h-3.5 bg-beige-200 text-beige-600 border border-beige-300/80 dark:bg-beige-800/80 dark:text-beige-400 dark:border-beige-700/80 flex items-center justify-center select-none text-[5px] opacity-60 dark:opacity-40 hover:opacity-100 transition-opacity"
                >
                  ${slot.id > 999 ? String(slot.id).slice(-2) : slot.id}
                </div>
              `;
            }
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderQuoteDetail(quote?: UniqueQuoteStats, races: Race[] = []): string {
  if (!quote) return "";

  // Filter user races for this specific quote textId
  const quoteRaces = races
    .filter((r) => r.textId === quote.textId)
    .sort((a, b) => new Date(a.date.replace(" ", "T")).getTime() - new Date(b.date.replace(" ", "T")).getTime());

  return `
    <div class="bg-beige-200 dark:bg-beige-800 border-2 border-red-900/80 dark:border-red-500/80 p-4 flex flex-col gap-2.5 font-mono my-2 animate-fadeIn text-beige-900 dark:text-beige-100 shadow-md">
      <div class="flex items-center justify-between border-b border-beige-300 dark:border-beige-700 pb-2">
        <span class="text-sm font-bold text-beige-900 dark:text-beige-100 flex items-center gap-1.5">
          <span class="text-emerald-600 dark:text-emerald-400 font-bold text-base">✓</span> Text #${quote.textId} Breakdown
        </span>
        <a
          href="https://data.typeracer.com/pit/text_info?info_retry=1&id=${quote.textId}"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-red-900 dark:text-red-400 font-bold underline hover:text-red-700 dark:hover:text-red-300"
        >
          View Quote on TypeRacer ↗
        </a>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block font-sans">Times Completed</span>
          <span class="font-bold text-beige-900 dark:text-beige-100 text-sm">${quote.count} ${quote.count === 1 ? "time" : "times"}</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block font-sans">Peak Speed</span>
          <span class="font-bold text-red-900 dark:text-red-400 text-sm">${quote.bestWpm.toFixed(1)} WPM</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block font-sans">Avg Speed</span>
          <span class="font-bold text-beige-900 dark:text-beige-100 text-sm">${quote.avgWpm.toFixed(1)} WPM</span>
        </div>
        <div>
          <span class="text-[10px] uppercase text-beige-600 dark:text-beige-400 block font-sans">Last Completed</span>
          <span class="font-bold text-beige-900 dark:text-beige-100 text-sm">${formatDisplayDate(quote.lastTyped)}</span>
        </div>
      </div>

      <!-- Render WPM / Accuracy Micro Progression Sparkline if typed 2x+ -->
      ${quoteRaces.length > 1 ? renderQuoteSparkline(quoteRaces) : ""}
    </div>
  `;
}

function renderQuoteSparkline(races: Race[]): string {
  if (races.length < 2) return "";

  const width = 500;
  const height = 110;
  const padL = 40;
  const padR = 20;
  const padT = 20;
  const padB = 25;

  const wpms = races.map((r) => r.speed);
  const accs = races.map((r) => r.accuracy <= 1 ? r.accuracy * 100 : r.accuracy);

  const minWpm = Math.max(0, Math.floor(Math.min(...wpms) - 5));
  const maxWpm = Math.ceil(Math.max(...wpms) + 5);

  const minAcc = Math.max(0, Math.floor(Math.min(...accs) - 2));
  const maxAcc = Math.min(100, Math.ceil(Math.max(...accs) + 2));

  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const wpmPoints = races.map((r, i) => {
    const x = padL + (i / (races.length - 1)) * plotW;
    const y = padT + plotH - ((r.speed - minWpm) / (maxWpm - minWpm || 1)) * plotH;
    return { x, y, wpm: r.speed, date: r.date, acc: r.accuracy };
  });

  const accPoints = races.map((r, i) => {
    const accVal = r.accuracy <= 1 ? r.accuracy * 100 : r.accuracy;
    const x = padL + (i / (races.length - 1)) * plotW;
    const y = padT + plotH - ((accVal - minAcc) / (maxAcc - minAcc || 1)) * plotH;
    return { x, y, acc: accVal };
  });

  const wpmPath = wpmPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const accPath = accPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return `
    <div class="mt-3 pt-3 border-t border-beige-300 dark:border-beige-700 flex flex-col gap-1.5 font-mono">
      <div class="flex items-center justify-between text-xs font-bold text-beige-900 dark:text-beige-100">
        <span class="flex items-center gap-1.5 uppercase tracking-wide">
          <span>📈</span> REPEAT PROGRESSION (${races.length} Races Typed)
        </span>
        <div class="flex items-center gap-3 text-[10px]">
          <span class="flex items-center gap-1 text-red-900 dark:text-red-400 font-bold"><span class="w-2.5 h-0.5 bg-red-900 dark:bg-red-400 inline-block"></span> WPM Speed</span>
          <span class="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold"><span class="w-2.5 h-0.5 bg-emerald-600 dark:bg-emerald-400 inline-block"></span> Accuracy %</span>
        </div>
      </div>

      <div class="w-full overflow-x-auto">
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-28 overflow-visible">
          <!-- Background Grid Lines -->
          <line x1="${padL}" y1="${padT}" x2="${width - padR}" y2="${padT}" stroke="currentColor" class="text-beige-300 dark:text-beige-700 opacity-40" stroke-dasharray="2 2" />
          <line x1="${padL}" y1="${padT + plotH / 2}" x2="${width - padR}" y2="${padT + plotH / 2}" stroke="currentColor" class="text-beige-300 dark:text-beige-700 opacity-40" stroke-dasharray="2 2" />
          <line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="currentColor" class="text-beige-300 dark:text-beige-700 opacity-40" />

          <!-- WPM Path Line -->
          <path d="${wpmPath}" fill="none" stroke="#800000" stroke-width="2.5" class="dark:stroke-red-400" />

          <!-- Accuracy Path Line -->
          <path d="${accPath}" fill="none" stroke="#059669" stroke-width="2" stroke-dasharray="3 3" class="dark:stroke-emerald-400" />

          <!-- Data Points & Dots -->
          ${wpmPoints
            .map(
              (p, i) => `
            <g class="group cursor-pointer">
              <!-- WPM Dot -->
              <circle cx="${p.x}" cy="${p.y}" r="4" class="fill-red-900 dark:fill-red-400 stroke-beige-100 dark:stroke-beige-900" stroke-width="1.5" />
              <text x="${p.x}" y="${p.y - 6}" text-anchor="middle" class="text-[9px] font-bold fill-red-900 dark:fill-red-400 font-mono">${p.wpm.toFixed(0)}</text>

              <!-- Accuracy Dot -->
              <circle cx="${accPoints[i].x}" cy="${accPoints[i].y}" r="3" class="fill-emerald-600 dark:fill-emerald-400 stroke-beige-100 dark:stroke-beige-900" stroke-width="1" />

              <!-- X-Axis Label -->
              <text x="${p.x}" y="${height - 5}" text-anchor="middle" class="text-[8px] fill-beige-600 dark:fill-beige-400 font-mono">Race #${i + 1}</text>
            </g>
          `
            )
            .join("")}
        </svg>
      </div>
    </div>
  `;
}
