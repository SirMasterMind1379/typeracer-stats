import type { OverlaySettings } from "../types";

export class OverlayUI {
  private hostEl: HTMLElement;
  private shadowRoot: ShadowRoot;
  private containerEl!: HTMLElement;
  public quoteWidgetEl!: HTMLElement;
  public streakWidgetEl!: HTMLElement;
  public racesWidgetEl!: HTMLElement;
  public settingsWidgetEl!: HTMLElement;

  private settings: OverlaySettings = {
    notifyOneHourBefore: true,
    showSparkline: true,
    collapsed: false,
    position: { x: 20, y: 20 },
  };

  private onSettingsChangeCallback: (settings: OverlaySettings) => void;

  constructor(cssContent: string, onSettingsChange: (settings: OverlaySettings) => void) {
    this.onSettingsChangeCallback = onSettingsChange;
    this.loadSettings();

    // Create host element
    this.hostEl = document.createElement("div");
    this.hostEl.id = "typeracer-stats-overlay-root";
    document.body.appendChild(this.hostEl);

    // Create ShadowDOM
    this.shadowRoot = this.hostEl.attachShadow({ mode: "open" });

    // Inject Stylesheet
    const styleEl = document.createElement("style");
    styleEl.textContent = cssContent;
    this.shadowRoot.appendChild(styleEl);

    // Build DOM structure
    this.buildUI();
    this.initDrag();
  }

  private loadSettings(): void {
    try {
      const stored = localStorage.getItem("tr_overlay_settings");
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem("tr_overlay_settings", JSON.stringify(this.settings));
      this.onSettingsChangeCallback(this.settings);
    } catch {
      // ignore
    }
  }

  public getSettings(): OverlaySettings {
    return this.settings;
  }

  private buildUI(): void {
    this.containerEl = document.createElement("div");
    this.containerEl.className = `tr-overlay-container ${this.settings.collapsed ? "collapsed" : ""}`;

    this.containerEl.innerHTML = `
      <div class="tr-overlay-header" id="tr-header">
        <div class="tr-overlay-title">
          <span class="tr-logo-badge">TR</span>
          <span>Stats Overlay</span>
        </div>
        <div class="tr-overlay-actions">
          <button class="tr-icon-btn" id="tr-btn-settings" title="Settings">⚙</button>
          <button class="tr-icon-btn" id="tr-btn-collapse" title="Collapse/Expand">
            ${this.settings.collapsed ? "＋" : "－"}
          </button>
        </div>
      </div>

      <div class="tr-overlay-body">
        <div id="tr-quote-widget"></div>
        <div id="tr-streak-widget"></div>
        <div id="tr-races-widget"></div>
        <div id="tr-settings-widget" style="display: none;"></div>
      </div>
    `;

    this.shadowRoot.appendChild(this.containerEl);

    this.quoteWidgetEl = this.shadowRoot.getElementById("tr-quote-widget")!;
    this.streakWidgetEl = this.shadowRoot.getElementById("tr-streak-widget")!;
    this.racesWidgetEl = this.shadowRoot.getElementById("tr-races-widget")!;
    this.settingsWidgetEl = this.shadowRoot.getElementById("tr-settings-widget")!;

    // Bind Header Buttons
    const collapseBtn = this.shadowRoot.getElementById("tr-btn-collapse")!;
    collapseBtn.addEventListener("click", () => {
      this.settings.collapsed = !this.settings.collapsed;
      this.containerEl.classList.toggle("collapsed", this.settings.collapsed);
      collapseBtn.textContent = this.settings.collapsed ? "＋" : "－";
      this.saveSettings();
    });

    const settingsBtn = this.shadowRoot.getElementById("tr-btn-settings")!;
    settingsBtn.addEventListener("click", () => {
      const isHidden = this.settingsWidgetEl.style.display === "none";
      this.settingsWidgetEl.style.display = isHidden ? "block" : "none";
      if (isHidden) {
        this.renderSettingsPanel();
      }
    });
  }

  private renderSettingsPanel(): void {
    this.settingsWidgetEl.innerHTML = `
      <div class="tr-card">
        <div class="tr-card-title">Overlay Settings</div>
        <div class="tr-setting-row">
          <span>Notify 1 Hour Before Reset</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-notify" ${this.settings.notifyOneHourBefore ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>
      </div>
    `;

    const notifyCheckbox = this.shadowRoot.getElementById("tr-set-notify") as HTMLInputElement;
    if (notifyCheckbox) {
      notifyCheckbox.addEventListener("change", () => {
        this.settings.notifyOneHourBefore = notifyCheckbox.checked;
        this.saveSettings();
      });
    }
  }

  private initDrag(): void {
    const header = this.shadowRoot.getElementById("tr-header")!;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e: MouseEvent) => {
      isDragging = true;
      const rect = this.containerEl.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      // Keep within screen bounds
      x = Math.max(10, Math.min(window.innerWidth - 350, x));
      y = Math.max(10, Math.min(window.innerHeight - 100, y));

      this.containerEl.style.left = `${x}px`;
      this.containerEl.style.top = `${y}px`;
      this.containerEl.style.right = "auto";

      this.settings.position = { x, y };
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.saveSettings();
      }
    });
  }
}
