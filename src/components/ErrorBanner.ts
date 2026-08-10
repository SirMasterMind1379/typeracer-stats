export function renderErrorBanner(message: string): HTMLElement {
  const container = document.createElement("div");
  container.className = "w-full p-4 bg-red-50 dark:bg-red-950 border border-red-700 text-red-800 dark:text-red-200 text-sm";
  container.textContent = message;
  return container;
}
