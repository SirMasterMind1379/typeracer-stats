import Papa from "papaparse";
import JSZip from "jszip";
import type { Race } from "../types";

export interface DataImportProps {
  onDataParsed: (races: Race[], username: string) => void;
}

function parseCSVText(text: string): Race[] {
  const results: Race[] = [];
  Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
    step: (row: any) => {
      const r = row.data;
      const wpm = parseFloat(r.WPM ?? r.wpm);
      if (isNaN(wpm)) return;
      results.push({
        id: r["Race ID"] || r.rid || "",
        date: r["Date/Time (UTC)"] || r.t || r.date || "",
        speed: wpm,
        accuracy: parseFloat(r.Accuracy ?? r.acc ?? 0) * 100,
        points: parseFloat(r.Points ?? r.pts ?? 0) || null,
        rank: parseInt(r.Rank ?? r.r ?? 0),
        totalRacers: parseInt(r["# Racers"] ?? r.nr ?? 0),
        textId: parseInt(r["Text ID"] ?? r.tid ?? 0),
        won: parseInt(r.Rank ?? r.r ?? 0) === 1,
        mode: r.Mode || r.mode || undefined,
      });
    },
  });
  return results;
}

function extractUsername(fileName: string): string {
  const name = fileName.replace(/^@?tr_/, "").replace(/_play.*$/, "").replace(/\.(csv|zip)$/i, "");
  return name || "export";
}

export function renderDataImport(props: DataImportProps): HTMLElement {
  const container = document.createElement("div");
  container.className = "border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 p-4 w-full text-beige-900 dark:text-beige-100";

  let dragging = false;
  let parsing = false;
  let status = "";

  async function processFile(file: File) {
    parsing = true;
    status = `Reading ${file.name}...`;
    update();

    try {
      const isZip = file.name.toLowerCase().endsWith(".zip");
      let csvText: string;

      if (isZip) {
        status = "Extracting ZIP...";
        update();
        const arrayBuf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuf);
        const csvEntry = Object.entries(zip.files).find(
          ([, entry]) => !entry.dir && entry.name.toLowerCase().endsWith(".csv")
        );
        if (!csvEntry) {
          status = "No CSV found inside ZIP";
          parsing = false;
          update();
          return;
        }
        csvText = await csvEntry[1].async("text");
      } else {
        csvText = await file.text();
      }

      status = "Parsing CSV...";
      update();
      await new Promise((r) => setTimeout(r, 0));
      const races = parseCSVText(csvText);

      if (races.length === 0) {
        status = "No valid race data found in file";
        parsing = false;
        update();
        return;
      }

      const username = extractUsername(file.name);
      status = `Loaded ${races.length} races from export`;
      update();
      setTimeout(() => {
        props.onDataParsed(races, username);
        parsing = false;
        status = "";
        update();
      }, 500);
    } catch (err: any) {
      status = `Error: ${err.message}`;
      parsing = false;
      update();
    }
  }

  function update() {
    container.innerHTML = `
      <h3 class="text-sm font-semibold mb-3 text-beige-700 dark:text-beige-300 uppercase tracking-wide">
        Import Race Export
      </h3>
      <p class="text-xs text-beige-600 dark:text-beige-400 mb-3">
        Export your race history from
        <a
          href="https://data.typeracer.com/pit/export_data?universe=play"
          target="_blank"
          rel="noopener noreferrer"
          class="text-red-900 dark:text-red-400 underline"
        >
          data.typeracer.com/pit/export_data?universe=play
        </a>
        and drop the <code>.csv</code> or <code>.zip</code> file below.
      </p>

      <div
        id="drop-zone"
        class="border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-red-900 bg-red-50 dark:bg-red-950"
            : "border-beige-300 dark:border-beige-700 hover:border-red-900 dark:hover:border-red-400"
        } ${parsing ? "opacity-50 pointer-events-none" : ""}"
      >
        <input
          id="file-input"
          type="file"
          accept=".csv,.zip"
          class="hidden"
        />
        ${
          parsing
            ? `
          <div class="flex flex-col items-center gap-2">
            <div class="flex gap-1">
              <div class="w-2 h-2 bg-red-900 dark:bg-red-400 animate-pulse-square"></div>
              <div class="w-2 h-2 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.15s"></div>
              <div class="w-2 h-2 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.3s"></div>
              <div class="w-2 h-2 bg-red-900 dark:bg-red-400 animate-pulse-square" style="animation-delay: 0.45s"></div>
            </div>
            <span class="text-xs text-beige-600 dark:text-beige-400">${status}</span>
          </div>
        `
            : `
          <p class="text-sm text-beige-600 dark:text-beige-400">
            Drop your <code>.csv</code> or <code>.zip</code> file here, or click to browse
          </p>
        `
        }
      </div>
    `;

    const dropZone = container.querySelector("#drop-zone");
    const fileInput = container.querySelector("#file-input") as HTMLInputElement;

    dropZone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dragging = true;
      dropZone.classList.add("border-red-900", "bg-red-50");
    });

    dropZone?.addEventListener("dragleave", () => {
      dragging = false;
      dropZone.classList.remove("border-red-900", "bg-red-50");
    });

    dropZone?.addEventListener("drop", (e) => {
      e.preventDefault();
      dragging = false;
      const f = (e as DragEvent).dataTransfer?.files?.[0];
      if (f && (f.name.endsWith(".csv") || f.name.endsWith(".zip"))) {
        processFile(f);
      }
    });

    dropZone?.addEventListener("click", () => {
      fileInput?.click();
    });

    fileInput?.addEventListener("change", (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) processFile(f);
    });
  }

  update();
  return container;
}
