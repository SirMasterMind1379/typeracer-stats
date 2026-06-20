import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import JSZip from "jszip";
import type { Race } from "./types";

interface DataImportProps {
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

export default function DataImport({ onDataParsed }: DataImportProps) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setParsing(true);
    setStatus(`Reading ${file.name}...`);
    try {
      const isZip = file.name.toLowerCase().endsWith(".zip");
      let csvText: string;

      if (isZip) {
        setStatus("Extracting ZIP...");
        const arrayBuf = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuf);
        const csvEntry = Object.entries(zip.files).find(
          ([, entry]) => !entry.dir && entry.name.toLowerCase().endsWith(".csv")
        );
        if (!csvEntry) {
          setStatus("No CSV found inside ZIP");
          setParsing(false);
          return;
        }
        csvText = await csvEntry[1].async("text");
      } else {
        csvText = await file.text();
      }

      setStatus("Parsing CSV...");
      await new Promise((r) => setTimeout(r, 0));
      const races = parseCSVText(csvText);

      if (races.length === 0) {
        setStatus("No valid race data found in file");
        setParsing(false);
        return;
      }

      const username = extractUsername(file.name);
      setStatus(`Loaded ${races.length} races from export`);
      setTimeout(() => {
        onDataParsed(races, username);
        setParsing(false);
        setStatus("");
      }, 500);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
      setParsing(false);
    }
  }, [onDataParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".zip"))) {
      processFile(f);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  return (
    <div className="border border-beige-300 dark:border-zinc-700 p-4">
      <h3 className="text-sm font-semibold mb-3 text-beige-700 dark:text-zinc-400 uppercase tracking-wide">
        Import Race Export
      </h3>
      <p className="text-xs text-beige-600 dark:text-zinc-500 mb-3">
        Export your race history from{" "}
        <a
          href="https://data.typeracer.com/pit/export_data?universe=play"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-900 dark:text-red-400 underline"
        >
          data.typeracer.com/pit/export_data?universe=play
        </a>{" "}
        and drop the <code>.csv</code> or <code>.zip</code> file below.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-red-900 bg-red-50 dark:bg-red-950"
            : "border-beige-300 dark:border-zinc-700 hover:border-red-900 dark:hover:border-red-400"
        } ${parsing ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.zip"
          className="hidden"
          onChange={handleFileSelect}
        />
        {parsing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-red-900 dark:bg-red-400 animate-pulse-square"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <span className="text-xs text-beige-600 dark:text-zinc-500">{status}</span>
          </div>
        ) : (
          <p className="text-sm text-beige-600 dark:text-zinc-500">
            Drop your <code>.csv</code> or <code>.zip</code> file here, or click to browse
          </p>
        )}
      </div>
    </div>
  );
}
