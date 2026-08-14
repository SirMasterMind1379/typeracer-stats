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
    username: "",
    apiKey: "",
    themeMode: "auto",
    hideUpsells: true,
    dimensions: { width: 340, height: 420 },
  };

  private onSettingsChangeCallback: (settings: OverlaySettings) => void;
  private onRefreshCallback?: () => Promise<void> | void;

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

    // Build DOM structure & apply theme
    this.buildUI();
    this.applyTheme();
    this.initDrag();
    this.initBorderResize();
    this.initResizeObserver();
    this.initSystemThemeListener();
  }

  public setOnRefresh(cb: () => Promise<void> | void): void {
    this.onRefreshCallback = cb;
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

  public saveSettings(): void {
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

  public updateUsernameTitle(username: string): void {
    const titleContainer = this.shadowRoot.querySelector("#tr-header-title-container");
    if (titleContainer) {
      if (username) {
        titleContainer.innerHTML = `<a href="https://data.typeracer.com/pit/profile?user=${encodeURIComponent(username)}" target="_blank" rel="noopener" class="tr-user-link">@${username}</a>`;
      } else {
        titleContainer.textContent = "TypeRacer Stats";
      }
    }
  }

  private getEffectiveTheme(): "light" | "dark" {
    const mode = this.settings.themeMode || "auto";
    if (mode === "light") return "light";
    if (mode === "dark") return "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  private applyTheme(): void {
    const theme = this.getEffectiveTheme();
    this.containerEl.classList.remove("light", "dark");
    this.containerEl.classList.add(theme);

    const themeBtn = this.shadowRoot.getElementById("tr-btn-theme");
    if (themeBtn) {
      const mode = (this.settings.themeMode || "auto").toUpperCase();
      themeBtn.textContent = mode;
      themeBtn.title = `Theme Mode: ${mode} (Click to toggle AUTO ➔ LIGHT ➔ DARK)`;
    }
  }

  private cycleTheme(): void {
    const current = this.settings.themeMode || "auto";
    if (current === "auto") {
      this.settings.themeMode = "light";
    } else if (current === "light") {
      this.settings.themeMode = "dark";
    } else {
      this.settings.themeMode = "auto";
    }
    this.applyTheme();
    this.saveSettings();
  }

  private initSystemThemeListener(): void {
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if ((this.settings.themeMode || "auto") === "auto") {
          this.applyTheme();
        }
      });
    }
  }

  private buildUI(): void {
    this.containerEl = document.createElement("div");
    this.containerEl.className = `tr-overlay-container ${this.settings.collapsed ? "collapsed" : ""}`;

    if (this.settings.dimensions?.width) {
      this.containerEl.style.width = `${this.settings.dimensions.width}px`;
    }
    if (this.settings.dimensions?.height && !this.settings.collapsed) {
      this.containerEl.style.height = `${this.settings.dimensions.height}px`;
    }

    const initialTitleHtml = this.settings.username
      ? `<a href="https://data.typeracer.com/pit/profile?user=${encodeURIComponent(this.settings.username)}" target="_blank" rel="noopener" class="tr-user-link">@${this.settings.username}</a>`
      : "TypeRacer Stats";

    const currentModeText = (this.settings.themeMode || "auto").toUpperCase();

    this.containerEl.innerHTML = `
      <!-- Windows-style 8-direction border resize handles -->
      <div class="tr-rh tr-rh-n" data-dir="n"></div>
      <div class="tr-rh tr-rh-s" data-dir="s"></div>
      <div class="tr-rh tr-rh-e" data-dir="e"></div>
      <div class="tr-rh tr-rh-w" data-dir="w"></div>
      <div class="tr-rh tr-rh-ne" data-dir="ne"></div>
      <div class="tr-rh tr-rh-nw" data-dir="nw"></div>
      <div class="tr-rh tr-rh-se" data-dir="se"></div>
      <div class="tr-rh tr-rh-sw" data-dir="sw"></div>

      <div class="tr-overlay-header" id="tr-header">
        <div class="tr-overlay-title">
          <span class="tr-logo-badge">TR</span>
          <span id="tr-header-title-container">${initialTitleHtml}</span>
        </div>
        <div class="tr-overlay-actions">
          <button class="tr-icon-btn" id="tr-btn-refresh" title="Reload Stats & Sync Recent Races">↻</button>
          <button class="tr-icon-btn" id="tr-btn-theme" title="Theme Mode">${currentModeText}</button>
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

    // Bind Refresh Button
    const refreshBtn = this.shadowRoot.getElementById("tr-btn-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (this.onRefreshCallback) {
          refreshBtn.classList.add("spinning");
          try {
            await this.onRefreshCallback();
          } catch (err) {
            console.warn("[TypeRacer Overlay] Manual refresh error:", err);
          } finally {
            setTimeout(() => refreshBtn.classList.remove("spinning"), 400);
          }
        }
      });
    }

    // Bind Header Buttons
    const themeBtn = this.shadowRoot.getElementById("tr-btn-theme")!;
    themeBtn.addEventListener("click", () => this.cycleTheme());

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
    const currentMode = this.settings.themeMode || "auto";
    const hideUpsells = this.settings.hideUpsells ?? true;

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

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Hide Premium Upsells & Ads</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-upsells" ${hideUpsells ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Theme Mode</span>
          <select id="tr-set-theme" style="background: rgba(0,0,0,0.3); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; padding: 2px 6px; font-size: 11px;">
            <option value="auto" ${currentMode === "auto" ? "selected" : ""}>Auto (System)</option>
            <option value="light" ${currentMode === "light" ? "selected" : ""}>Light (Sunny Cream)</option>
            <option value="dark" ${currentMode === "dark" ? "selected" : ""}>Dark (Red Velvet)</option>
          </select>
        </div>

        <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 10px; color: inherit; opacity: 0.7; font-weight: 700;">TYPERACER USERNAME</label>
          <input type="text" id="tr-set-username" value="${this.settings.username || ''}" placeholder="Auto-detected or enter username" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.3); color: inherit; padding: 6px 8px; border-radius: 4px; font-size: 11px; width: 100%;">

          <label style="font-size: 10px; color: inherit; opacity: 0.7; font-weight: 700; margin-top: 4px;">API KEY (OPTIONAL)</label>
          <input type="password" id="tr-set-apikey" value="${this.settings.apiKey || ''}" placeholder="API Key for full historical data" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(128,128,128,0.3); color: inherit; padding: 6px 8px; border-radius: 4px; font-size: 11px; width: 100%;">

          <div style="font-size: 10px; opacity: 0.85; line-height: 1.4; background: rgba(0,0,0,0.15); border: 1px dashed rgba(128,128,128,0.25); padding: 6px 8px; border-radius: 4px; margin-top: 2px;">
            💡 <strong>How to find your API Key:</strong><br>
            Sign into TypeRacer ➔ visit your <a href="https://data.typeracer.com/pit/profile" target="_blank" rel="noopener" style="color: #ef4444; font-weight: 700; text-decoration: underline;">TypeRacer Pit Profile</a> ➔ scroll to <strong>Account Settings</strong> to copy your secret key.
          </div>

          <button id="tr-save-credentials" style="background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; cursor: pointer; margin-top: 6px;">Save & Sync Stats</button>
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

    const upsellsCheckbox = this.shadowRoot.getElementById("tr-set-upsells") as HTMLInputElement;
    if (upsellsCheckbox) {
      upsellsCheckbox.addEventListener("change", () => {
        this.settings.hideUpsells = upsellsCheckbox.checked;
        this.saveSettings();
      });
    }

    const themeSelect = this.shadowRoot.getElementById("tr-set-theme") as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.addEventListener("change", () => {
        this.settings.themeMode = themeSelect.value as "auto" | "light" | "dark";
        this.applyTheme();
        this.saveSettings();
      });
    }

    const saveBtn = this.shadowRoot.getElementById("tr-save-credentials");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const userInput = (this.shadowRoot.getElementById("tr-set-username") as HTMLInputElement)?.value.trim();
        const keyInput = (this.shadowRoot.getElementById("tr-set-apikey") as HTMLInputElement)?.value.trim();
        this.settings.username = userInput;
        this.settings.apiKey = keyInput;
        this.updateUsernameTitle(userInput);
        this.saveSettings();
        this.settingsWidgetEl.style.display = "none";
      });
    }
  }

  private initDrag(): void {
    const header = this.shadowRoot.getElementById("tr-header")!;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "A" || target.closest("a") || target.closest("button") || target.classList.contains("tr-rh")) {
        return;
      }
      isDragging = true;
      const rect = this.containerEl.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      x = Math.max(10, Math.min(window.innerWidth - 300, x));
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

  private initBorderResize(): void {
    const handles = this.shadowRoot.querySelectorAll(".tr-rh");
    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (e: Event) => {
        const mouseEvent = e as MouseEvent;
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();

        const dir = (handle as HTMLElement).dataset.dir;
        const startX = mouseEvent.clientX;
        const startY = mouseEvent.clientY;
        const rect = this.containerEl.getBoundingClientRect();
        const startW = rect.width;
        const startH = rect.height;
        const startL = rect.left;
        const startT = rect.top;

        const onMouseMove = (moveEvent: MouseEvent) => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          let newW = startW;
          let newH = startH;
          let newL = startL;
          let newT = startT;

          if (dir?.includes("e")) newW = Math.max(280, Math.min(600, startW + dx));
          if (dir?.includes("s")) newH = Math.max(200, Math.min(850, startH + dy));
          if (dir?.includes("w")) {
            newW = Math.max(280, Math.min(600, startW - dx));
            newL = startL + (startW - newW);
          }
          if (dir?.includes("n")) {
            newH = Math.max(200, Math.min(850, startH - dy));
            newT = startT + (startH - newH);
          }

          this.containerEl.style.width = `${newW}px`;
          this.containerEl.style.height = `${newH}px`;
          this.containerEl.style.left = `${newL}px`;
          this.containerEl.style.top = `${newT}px`;
          this.containerEl.style.right = "auto";

          this.settings.position = { x: newL, y: newT };
          this.settings.dimensions = { width: newW, height: newH };
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
          this.saveSettings();
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    });
  }

  private initResizeObserver(): void {
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (!this.settings.collapsed) {
            const w = Math.round(entry.contentRect.width);
            const h = Math.round(entry.contentRect.height);
            if (w > 0 && h > 0) {
              this.settings.dimensions = { width: w, height: h };
            }
          }
        }
      });
      ro.observe(this.containerEl);
    }
  }
}
