import { useRef, useCallback } from "react";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";

export default function ExportButton({ targetId, filename }: { targetId: string; filename: string }) {
  const exporting = useRef(false);

  const handleExport = useCallback(async () => {
    if (exporting.current) return;
    exporting.current = true;
    const el = document.getElementById(targetId);
    if (!el) { exporting.current = false; return; }
    try {
      const canvas = await html2canvas(el, { backgroundColor: null, scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = filename;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { /* ignore */ }
    exporting.current = false;
  }, [targetId, filename]);

  return (
    <button
      onClick={handleExport}
      className="p-1.5 border border-beige-300 dark:border-zinc-600 bg-beige-50 dark:bg-zinc-800 hover:bg-beige-200 dark:hover:bg-zinc-700"
      aria-label="Export as PNG"
    >
      <Download size={14} />
    </button>
  );
}
