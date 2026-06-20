import { useRef, useState, useCallback } from "react";
import { Download } from "lucide-react";
import domtoimage from "dom-to-image-more";

export default function ExportButton({ targetId, filename }: { targetId: string; filename: string }) {
  const exporting = useRef(false);
  const [err, setErr] = useState("");

  const handleExport = useCallback(async () => {
    if (exporting.current) return;
    exporting.current = true;
    setErr("");

    const el = document.getElementById(targetId);
    if (!el) { exporting.current = false; return; }

    try {
      const isDark = document.documentElement.classList.contains("dark");
      const bg = isDark ? "#18181b" : "#fefce8";

      const dataUrl = await domtoimage.toPng(el, {
        bgcolor: bg,
        pixelRatio: window.devicePixelRatio || 2,
        ignoreCSSRuleErrors: true,
        onImageError: () => {},
        filter: (node) => {
          if (node instanceof HTMLElement && node.classList.contains("no-export")) {
            return false;
          }
          return true;
        },
        onclone: (clone) => {
          if (isDark && clone instanceof HTMLElement) {
            const doc = clone.ownerDocument;
            if (doc) doc.documentElement.classList.add("dark");
          }
        },
      });

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (caught) {
      const msg = caught instanceof Error ? caught.message : String(caught);
      console.error("Export failed:", caught);
      setErr(msg);
    }
    exporting.current = false;
  }, [targetId, filename]);

  return (
    <div className="no-export inline-flex items-center gap-1">
      {err && <span className="text-[10px] text-red-600 max-w-40 truncate">{err}</span>}
      <button
        onClick={handleExport}
        className="p-1.5 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-800 hover:bg-beige-200 dark:hover:bg-zinc-700"
        aria-label="Export as PNG"
      >
        <Download size={14} />
      </button>
    </div>
  );
}
