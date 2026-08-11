import type { Race } from "../types";
import { formatDisplayDate } from "../types";

type SortField = "raceNum" | "date" | "mode" | "speed" | "accuracy" | "points" | "rank";
type SortOrder = "asc" | "desc";

export interface RaceTableProps {
  races: Race[];
}

// Sortable, Filterable Race History Data Table (ASC/DESC column sorting, instant string search, pagination)
export function renderRaceTable(props: RaceTableProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "bg-beige-100 dark:bg-beige-900 border border-beige-300 dark:border-beige-700 p-4 flex flex-col gap-4 text-beige-900 dark:text-beige-100";

  let sortField: SortField = "date";
  let sortOrder: SortOrder = "desc";
  let filterText = "";
  let currentPage = 1;
  let pageSize = 25;

  const rawRaces = props.races;

  // Filter and sort race history data array
  function getSortedFilteredRaces() {
    let list = rawRaces.map((r, index) => ({ ...r, raceNum: index + 1 }));

    if (filterText.trim()) {
      const q = filterText.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.mode?.toLowerCase().includes(q) ||
          formatDisplayDate(r.date).toLowerCase().includes(q) ||
          String(r.speed).includes(q) ||
          String(r.raceNum).includes(q)
      );
    }

    list.sort((a, b) => {
      let va: any = a[sortField];
      let vb: any = b[sortField];
      if (sortField === "date") {
        va = new Date(a.date).getTime();
        vb = new Date(b.date).getTime();
      } else if (sortField === "mode") {
        va = a.mode || "";
        vb = b.mode || "";
      }
      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }

  // ── One-time header setup (search input + page size — never re-rendered) ──
  const headerRow = document.createElement("div");
  headerRow.className = "flex flex-wrap items-center justify-between gap-3";

  const titleEl = document.createElement("h3");
  titleEl.className = "text-sm font-semibold text-beige-700 dark:text-beige-300 uppercase tracking-wide flex items-center gap-2";
  titleEl.textContent = `Race History (${rawRaces.length} races)`;
  headerRow.appendChild(titleEl);

  const controlsEl = document.createElement("div");
  controlsEl.className = "flex items-center gap-2 flex-wrap";

  const searchInput = document.createElement("input");
  searchInput.id = "table-search";
  searchInput.type = "text";
  searchInput.placeholder = "Search mode, date, WPM...";
  searchInput.value = filterText;
  searchInput.className = "px-2.5 py-1 text-xs bg-beige-50 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100 focus:outline-none focus:border-red-900 dark:focus:border-red-500";
  searchInput.addEventListener("input", () => {
    filterText = searchInput.value;
    currentPage = 1;
    updateTable();
  });
  controlsEl.appendChild(searchInput);

  const pageSelect = document.createElement("select");
  pageSelect.id = "page-size-select";
  pageSelect.className = "px-2 py-1 text-xs bg-beige-50 dark:bg-beige-800 border border-beige-300 dark:border-beige-700 text-beige-900 dark:text-beige-100 focus:outline-none";
  [25, 50, 100].forEach((n) => {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = `${n} / page`;
    if (n === pageSize) opt.selected = true;
    pageSelect.appendChild(opt);
  });
  pageSelect.addEventListener("change", () => {
    pageSize = parseInt(pageSelect.value, 10);
    currentPage = 1;
    updateTable();
  });
  controlsEl.appendChild(pageSelect);

  headerRow.appendChild(controlsEl);
  container.appendChild(headerRow);

  // ── Dynamic table area (re-rendered on sort/filter/page changes) ──
  const tableWrap = document.createElement("div");
  tableWrap.className = "overflow-x-auto w-full border border-beige-300 dark:border-beige-800";
  container.appendChild(tableWrap);

  const paginationWrap = document.createElement("div");
  paginationWrap.className = "flex items-center justify-between text-xs text-beige-600 dark:text-beige-400";
  container.appendChild(paginationWrap);

  function updateTable() {
    const processed = getSortedFilteredRaces();
    const totalPages = Math.max(1, Math.ceil(processed.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const pageRows = processed.slice(startIdx, startIdx + pageSize);

    // Update title count
    titleEl.textContent = `Race History (${processed.length} races)`;

    // Re-render table
    tableWrap.innerHTML = `
      <table class="w-full text-left text-xs">
        <thead class="bg-beige-200 dark:bg-beige-800 text-beige-800 dark:text-beige-300 uppercase font-mono border-b border-beige-300 dark:border-beige-700">
          <tr>
            ${renderTh("raceNum", "Race #")}
            ${renderTh("date", "Date/Time")}
            ${renderTh("mode", "Mode")}
            ${renderTh("speed", "WPM")}
            ${renderTh("accuracy", "Accuracy")}
            ${renderTh("points", "Points")}
            ${renderTh("rank", "Rank / Racers")}
          </tr>
        </thead>
        <tbody class="divide-y divide-beige-200 dark:divide-beige-800 font-mono">
          ${
            pageRows.length === 0
              ? `<tr><td colspan="7" class="py-6 text-center text-beige-600 dark:text-beige-400">No races found</td></tr>`
              : pageRows
                  .map(
                    (r) => `
            <tr class="hover:bg-beige-200/60 dark:hover:bg-beige-800/60 transition-colors">
              <td class="py-2 px-3 text-beige-600 dark:text-beige-400">#${r.raceNum}</td>
              <td class="py-2 px-3 text-beige-900 dark:text-beige-100">${formatDisplayDate(r.date)}</td>
              <td class="py-2 px-3">
                <span class="px-1.5 py-0.5 text-[10px] uppercase border ${
                  r.mode?.toLowerCase().includes("qotd")
                    ? "border-amber-600 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300"
                    : r.mode?.toLowerCase().includes("room")
                    ? "border-purple-600 bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-300"
                    : r.mode?.toLowerCase().includes("practice") || (r.totalRacers <= 1 && !r.mode)
                    ? "border-blue-600 bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300"
                    : "border-beige-300 dark:border-beige-700 bg-beige-200 dark:bg-beige-800 text-beige-800 dark:text-beige-300"
                }">
                  ${r.mode || (r.totalRacers <= 1 ? "practice" : "multiplayer")}
                </span>
              </td>
              <td class="py-2 px-3 font-semibold text-beige-900 dark:text-beige-100">${r.speed.toFixed(1)}</td>
              <td class="py-2 px-3 text-beige-700 dark:text-beige-300">${r.accuracy.toFixed(1)}%</td>
              <td class="py-2 px-3 text-beige-700 dark:text-beige-300">${(r.points || 0).toFixed(0)}</td>
              <td class="py-2 px-3 text-beige-700 dark:text-beige-300">
                ${r.won ? `<span class="text-amber-600 dark:text-amber-400 font-bold">1st</span>` : `${r.rank}`} / ${r.totalRacers}
              </td>
            </tr>
          `
                  )
                  .join("")
          }
        </tbody>
      </table>
    `;

    // Re-render pagination bar
    paginationWrap.innerHTML = `
      <span>Showing ${processed.length === 0 ? 0 : startIdx + 1}–${Math.min(startIdx + pageSize, processed.length)} of ${processed.length} races</span>
      <div class="flex items-center gap-1">
        <button
          id="btn-prev-page"
          ${currentPage <= 1 ? "disabled" : ""}
          class="px-2 py-1 border border-beige-300 dark:border-beige-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed bg-beige-50 dark:bg-beige-800 text-beige-800 dark:text-beige-200 hover:bg-beige-200 dark:hover:bg-beige-700"
        >
          Prev
        </button>
        <span class="px-2">Page ${currentPage} of ${totalPages}</span>
        <button
          id="btn-next-page"
          ${currentPage >= totalPages ? "disabled" : ""}
          class="px-2 py-1 border border-beige-300 dark:border-beige-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed bg-beige-50 dark:bg-beige-800 text-beige-800 dark:text-beige-200 hover:bg-beige-200 dark:hover:bg-beige-700"
        >
          Next
        </button>
      </div>
    `;

    // Re-attach header sort listeners
    tableWrap.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const field = th.getAttribute("data-sort") as SortField;
        if (sortField === field) {
          sortOrder = sortOrder === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          sortOrder = "desc";
        }
        updateTable();
      });
    });

    // Attach Pagination click event listeners
    paginationWrap.querySelector("#btn-prev-page")?.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        updateTable();
      }
    });

    paginationWrap.querySelector("#btn-next-page")?.addEventListener("click", () => {
      if (currentPage < totalPages) {
        currentPage++;
        updateTable();
      }
    });
  }

  // Render Table Column Header with active ASC/DESC sort indicator
  function renderTh(field: SortField, label: string): string {
    const isCurrent = sortField === field;
    const arrow = isCurrent ? (sortOrder === "asc" ? " ▲" : " ▼") : "";
    return `
      <th data-sort="${field}" class="py-2 px-3 cursor-pointer hover:bg-beige-300 dark:hover:bg-beige-700 select-none">
        ${label}${arrow}
      </th>
    `;
  }

  updateTable();
  return container;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
