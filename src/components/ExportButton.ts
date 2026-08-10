import domtoimage from "dom-to-image-more";

export function renderExportButton(targetId: string, filename: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "no-export inline-flex items-center gap-1";

  let exporting = false;
  let err = "";

  function update() {
    container.innerHTML = `
      ${err ? `<span class="text-[10px] text-red-600 max-w-40 truncate">${escapeHtml(err)}</span>` : ""}
      <button
        id="export-btn"
        class="p-1.5 border border-beige-300 dark:border-beige-700 bg-beige-100 dark:bg-beige-900 hover:bg-beige-200 dark:hover:bg-beige-800 text-beige-900 dark:text-beige-100 cursor-pointer"
        aria-label="Export as PNG"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
      </button>
    `;

    container.querySelector("#export-btn")?.addEventListener("click", async () => {
      if (exporting) return;
      exporting = true;
      err = "";
      update();

      const el = document.getElementById(targetId);
      if (!el) { exporting = false; return; }

      try {
        const isDark = document.documentElement.classList.contains("dark");
        const bg = isDark ? "#1c1917" : "#fdfbf7";

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
        err = msg;
        update();
      }
      exporting = false;
    });
  }

  update();
  return container;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
