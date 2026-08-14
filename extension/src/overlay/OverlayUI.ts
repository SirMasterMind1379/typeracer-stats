import type { OverlaySettings } from "../types";

export class OverlayUI {
  private hostEl: HTMLElement;
  private shadowRoot: ShadowRoot;
  private containerEl!: HTMLElement;
  private snapPreviewEl!: HTMLElement;

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
    autoMinimizeOnRace: false,
    autoHideTopBar: false,
    transparentOverlay: false,
    wideMode: false,
    snapMode: "none",
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

    // Build DOM structure & apply theme / snap
    this.buildUI();
    this.applyTheme();
    this.applyInitialPositionAndSnap();
    this.initDrag();
    this.initBorderResize();
    this.initResizeObserver();
    this.initSystemThemeListener();
  }

  public setOnRefresh(cb: () => Promise<void> | void): void {
    this.onRefreshCallback = cb;
  }

  public setCollapsed(collapsed: boolean): void {
    if (this.settings.collapsed === collapsed) return;
    this.settings.collapsed = collapsed;
    this.containerEl.classList.toggle("collapsed", collapsed);
    const collapseBtn = this.shadowRoot.getElementById("tr-btn-collapse");
    if (collapseBtn) {
      collapseBtn.textContent = collapsed ? "＋" : "－";
    }
    if (collapsed) {
      this.closeSettings();
      this.clearBodyMargin();
    } else {
      if (this.settings.snapMode === "left-dock") {
        this.applyBodyMargin("left", 360);
      } else if (this.settings.snapMode === "right-dock") {
        this.applyBodyMargin("right", 360);
      }
    }
    this.saveSettings();
  }

  public isAutoMinimizeEnabled(): boolean {
    return !!this.settings.autoMinimizeOnRace;
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
        titleContainer.innerHTML = `<span class="tr-user-name">@${username}</span>`;
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
    this.containerEl.classList.toggle("transparent", !!this.settings.transparentOverlay);

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

  private toggleSettings(): void {
    const isHidden = this.settingsWidgetEl.style.display === "none";
    if (isHidden) {
      this.renderSettingsPanel();
      this.settingsWidgetEl.style.display = "flex";
      this.shadowRoot.getElementById("tr-btn-settings")?.classList.add("active");
    } else {
      this.closeSettings();
    }
  }

  private closeSettings(): void {
    this.settingsWidgetEl.style.display = "none";
    this.shadowRoot.getElementById("tr-btn-settings")?.classList.remove("active");
  }

  private applyInitialPositionAndSnap(): void {
    const snap = this.settings.snapMode || "none";
    if (snap !== "none") {
      this.applySnap(snap);
    } else {
      if (this.settings.position) {
        this.containerEl.style.left = `${this.settings.position.x}px`;
        this.containerEl.style.top = `${this.settings.position.y}px`;
        this.containerEl.style.right = "auto";
      }
    }
  }

  private applyBodyMargin(side: "left" | "right", width: number): void {
    document.body.style.transition = "margin 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.25s ease";
    if (side === "left") {
      document.body.style.marginLeft = `${width}px`;
      document.body.style.marginRight = "0px";
      document.body.style.width = `calc(100% - ${width}px)`;
    } else {
      document.body.style.marginRight = `${width}px`;
      document.body.style.marginLeft = "0px";
      document.body.style.width = `calc(100% - ${width}px)`;
    }
  }

  private clearBodyMargin(): void {
    document.body.style.marginLeft = "";
    document.body.style.marginRight = "";
    document.body.style.width = "";
  }

  private clearDockClasses(): void {
    this.containerEl.classList.remove("docked-left", "docked-right");
  }

  private applySnap(mode: NonNullable<OverlaySettings["snapMode"]>): void {
    this.settings.snapMode = mode;

    if (mode === "left-dock") {
      this.containerEl.classList.remove("docked-right");
      this.containerEl.classList.add("docked-left");
      this.containerEl.style.left = "0px";
      this.containerEl.style.right = "auto";
      this.containerEl.style.top = "0px";
      this.containerEl.style.bottom = "0px";
      this.containerEl.style.width = "360px";
      this.containerEl.style.height = "100vh";
      if (!this.settings.collapsed) {
        this.applyBodyMargin("left", 360);
      }
    } else if (mode === "right-dock") {
      this.containerEl.classList.remove("docked-left");
      this.containerEl.classList.add("docked-right");
      this.containerEl.style.left = "auto";
      this.containerEl.style.right = "0px";
      this.containerEl.style.top = "0px";
      this.containerEl.style.bottom = "0px";
      this.containerEl.style.width = "360px";
      this.containerEl.style.height = "100vh";
      if (!this.settings.collapsed) {
        this.applyBodyMargin("right", 360);
      }
    } else if (mode === "top-left") {
      this.clearDockClasses();
      this.clearBodyMargin();
      this.containerEl.style.left = "8px";
      this.containerEl.style.top = "8px";
      this.containerEl.style.right = "auto";
      this.containerEl.style.bottom = "auto";
      this.containerEl.style.width = "340px";
      this.containerEl.style.height = "calc(50vh - 16px)";
      this.settings.position = { x: 8, y: 8 };
    } else if (mode === "top-right") {
      this.clearDockClasses();
      this.clearBodyMargin();
      const x = Math.max(10, window.innerWidth - 350);
      this.containerEl.style.left = `${x}px`;
      this.containerEl.style.top = "8px";
      this.containerEl.style.right = "auto";
      this.containerEl.style.bottom = "auto";
      this.containerEl.style.width = "340px";
      this.containerEl.style.height = "calc(50vh - 16px)";
      this.settings.position = { x, y: 8 };
    } else if (mode === "bottom-left") {
      this.clearDockClasses();
      this.clearBodyMargin();
      const y = Math.max(10, Math.floor(window.innerHeight / 2) + 8);
      this.containerEl.style.left = "8px";
      this.containerEl.style.top = `${y}px`;
      this.containerEl.style.right = "auto";
      this.containerEl.style.bottom = "auto";
      this.containerEl.style.width = "340px";
      this.containerEl.style.height = "calc(50vh - 16px)";
      this.settings.position = { x: 8, y };
    } else if (mode === "bottom-right") {
      this.clearDockClasses();
      this.clearBodyMargin();
      const x = Math.max(10, window.innerWidth - 350);
      const y = Math.max(10, Math.floor(window.innerHeight / 2) + 8);
      this.containerEl.style.left = `${x}px`;
      this.containerEl.style.top = `${y}px`;
      this.containerEl.style.right = "auto";
      this.containerEl.style.bottom = "auto";
      this.containerEl.style.width = "340px";
      this.containerEl.style.height = "calc(50vh - 16px)";
      this.settings.position = { x, y };
    } else {
      this.clearDockClasses();
      this.clearBodyMargin();
      this.containerEl.style.bottom = "auto";
      if (this.settings.dimensions?.width) {
        this.containerEl.style.width = `${this.settings.dimensions.width}px`;
      }
      if (this.settings.dimensions?.height && !this.settings.collapsed) {
        this.containerEl.style.height = `${this.settings.dimensions.height}px`;
      }
    }

    this.saveSettings();
  }

  private buildUI(): void {
    this.containerEl = document.createElement("div");
    this.containerEl.className = `tr-overlay-container ${this.settings.collapsed ? "collapsed" : ""} ${this.settings.transparentOverlay ? "transparent" : ""}`;

    if (this.settings.dimensions?.width) {
      this.containerEl.style.width = `${this.settings.dimensions.width}px`;
    }
    if (this.settings.dimensions?.height && !this.settings.collapsed) {
      this.containerEl.style.height = `${this.settings.dimensions.height}px`;
    }

    const initialTitleHtml = this.settings.username
      ? `<span class="tr-user-name">@${this.settings.username}</span>`
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
          <button class="tr-icon-btn" id="tr-btn-refresh" title="Reload Stats & Sync Recent Races">
            <span class="tr-refresh-icon" id="tr-icon-refresh-glyph">↻</span>
          </button>
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
      </div>

      <!-- Settings Modal Drawer Overlay -->
      <div id="tr-settings-widget" class="tr-settings-drawer" style="display: none;"></div>
    `;

    // Create Snap Preview Ghost Box
    this.snapPreviewEl = document.createElement("div");
    this.snapPreviewEl.className = "tr-snap-preview";
    this.snapPreviewEl.id = "tr-snap-preview";

    this.shadowRoot.appendChild(this.snapPreviewEl);
    this.shadowRoot.appendChild(this.containerEl);

    this.quoteWidgetEl = this.shadowRoot.getElementById("tr-quote-widget")!;
    this.streakWidgetEl = this.shadowRoot.getElementById("tr-streak-widget")!;
    this.racesWidgetEl = this.shadowRoot.getElementById("tr-races-widget")!;
    this.settingsWidgetEl = this.shadowRoot.getElementById("tr-settings-widget")!;

    // Bind Refresh Button (Animates only the glyph)
    const refreshBtn = this.shadowRoot.getElementById("tr-btn-refresh");
    const refreshGlyph = this.shadowRoot.getElementById("tr-icon-refresh-glyph");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (this.onRefreshCallback) {
          if (refreshGlyph) refreshGlyph.classList.add("spinning");
          try {
            await this.onRefreshCallback();
          } catch (err) {
            console.warn("[TypeRacer Overlay] Manual refresh error:", err);
          } finally {
            setTimeout(() => {
              if (refreshGlyph) refreshGlyph.classList.remove("spinning");
            }, 400);
          }
        }
      });
    }

    // Bind Header Buttons
    const themeBtn = this.shadowRoot.getElementById("tr-btn-theme")!;
    themeBtn.addEventListener("click", () => this.cycleTheme());

    const collapseBtn = this.shadowRoot.getElementById("tr-btn-collapse")!;
    collapseBtn.addEventListener("click", () => {
      this.setCollapsed(!this.settings.collapsed);
    });

    const settingsBtn = this.shadowRoot.getElementById("tr-btn-settings")!;
    settingsBtn.addEventListener("click", () => {
      if (this.settings.collapsed) {
        this.setCollapsed(false);
      }
      this.toggleSettings();
    });
  }

  private renderSettingsPanel(): void {
    const currentMode = this.settings.themeMode || "auto";
    const hideUpsells = this.settings.hideUpsells ?? true;
    const autoMin = this.settings.autoMinimizeOnRace ?? false;
    const autoTopBar = this.settings.autoHideTopBar ?? false;
    const transparentOverlay = this.settings.transparentOverlay ?? false;
    const wideMode = this.settings.wideMode ?? false;

    this.settingsWidgetEl.innerHTML = `
      <div class="tr-card" style="margin-bottom: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
          <span style="font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #ef4444;">⚙ Extension Settings</span>
          <button id="tr-btn-close-settings" class="tr-icon-btn" style="height: 20px; padding: 0 6px; font-size: 10px;">✕ Close</button>
        </div>
        
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
          <span>Auto-Minimize During Race</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-autominimize" ${autoMin ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Auto-Hide Top Bar (Hover to Show)</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-autohidetopbar" ${autoTopBar ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Window Transparency (Hover to Focus)</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-transparency" ${transparentOverlay ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>TypeRacer Wide Track Mode</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-widemode" ${wideMode ? "checked" : ""}>
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

    const closeBtn = this.shadowRoot.getElementById("tr-btn-close-settings");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeSettings());
    }

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

    const autoMinCheckbox = this.shadowRoot.getElementById("tr-set-autominimize") as HTMLInputElement;
    if (autoMinCheckbox) {
      autoMinCheckbox.addEventListener("change", () => {
        this.settings.autoMinimizeOnRace = autoMinCheckbox.checked;
        this.saveSettings();
      });
    }

    const autoTopBarCheckbox = this.shadowRoot.getElementById("tr-set-autohidetopbar") as HTMLInputElement;
    if (autoTopBarCheckbox) {
      autoTopBarCheckbox.addEventListener("change", () => {
        this.settings.autoHideTopBar = autoTopBarCheckbox.checked;
        this.saveSettings();
      });
    }

    const transparencyCheckbox = this.shadowRoot.getElementById("tr-set-transparency") as HTMLInputElement;
    if (transparencyCheckbox) {
      transparencyCheckbox.addEventListener("change", () => {
        this.settings.transparentOverlay = transparencyCheckbox.checked;
        this.containerEl.classList.toggle("transparent", this.settings.transparentOverlay);
        this.saveSettings();
      });
    }

    const wideModeCheckbox = this.shadowRoot.getElementById("tr-set-widemode") as HTMLInputElement;
    if (wideModeCheckbox) {
      wideModeCheckbox.addEventListener("change", () => {
        this.settings.wideMode = wideModeCheckbox.checked;
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
        this.closeSettings();
      });
    }
  }

  private initDrag(): void {
    const header = this.shadowRoot.getElementById("tr-header")!;
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    let currentSnapTarget: NonNullable<OverlaySettings["snapMode"]> = "none";

    header.addEventListener("mousedown", (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.closest("button") || target.classList.contains("tr-rh")) {
        return;
      }
      isDragging = true;
      currentSnapTarget = "none";

      // If window was docked, undock smoothly and follow cursor
      if (this.settings.snapMode && this.settings.snapMode !== "none") {
        this.clearDockClasses();
        this.clearBodyMargin();
        this.settings.snapMode = "none";
        this.containerEl.style.width = `${this.settings.dimensions?.width || 340}px`;
        this.containerEl.style.height = `${this.settings.dimensions?.height || 420}px`;
        offsetX = 170;
        offsetY = 20;
      } else {
        const rect = this.containerEl.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      }
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!isDragging) return;

      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      x = Math.max(0, Math.min(window.innerWidth - 100, x));
      y = Math.max(0, Math.min(window.innerHeight - 50, y));

      this.containerEl.style.left = `${x}px`;
      this.containerEl.style.top = `${y}px`;
      this.containerEl.style.right = "auto";
      this.containerEl.style.bottom = "auto";

      // Determine Snapping Targets (Left, Right, Corners)
      const isNearLeft = e.clientX < 50;
      const isNearRight = e.clientX > window.innerWidth - 50;
      const isNearTop = e.clientY < 70;
      const isNearBottom = e.clientY > window.innerHeight - 70;

      if (isNearLeft) {
        if (isNearTop) {
          currentSnapTarget = "top-left";
          this.updateSnapPreview(8, 8, "auto", "auto", 340, Math.floor(window.innerHeight / 2) - 16);
        } else if (isNearBottom) {
          currentSnapTarget = "bottom-left";
          this.updateSnapPreview(8, Math.floor(window.innerHeight / 2) + 8, "auto", "auto", 340, Math.floor(window.innerHeight / 2) - 16);
        } else {
          currentSnapTarget = "left-dock";
          this.updateSnapPreview(0, 0, "auto", 0, 360, window.innerHeight);
        }
      } else if (isNearRight) {
        if (isNearTop) {
          currentSnapTarget = "top-right";
          this.updateSnapPreview(window.innerWidth - 348, 8, "auto", "auto", 340, Math.floor(window.innerHeight / 2) - 16);
        } else if (isNearBottom) {
          currentSnapTarget = "bottom-right";
          this.updateSnapPreview(window.innerWidth - 348, Math.floor(window.innerHeight / 2) + 8, "auto", "auto", 340, Math.floor(window.innerHeight / 2) - 16);
        } else {
          currentSnapTarget = "right-dock";
          this.updateSnapPreview(window.innerWidth - 360, 0, "auto", 0, 360, window.innerHeight);
        }
      } else {
        currentSnapTarget = "none";
        this.snapPreviewEl.classList.remove("visible");
      }
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.snapPreviewEl.classList.remove("visible");

        if (currentSnapTarget !== "none") {
          this.applySnap(currentSnapTarget);
        } else {
          const rect = this.containerEl.getBoundingClientRect();
          this.settings.position = { x: rect.left, y: rect.top };
          this.settings.snapMode = "none";
          this.saveSettings();
        }
      }
    });
  }

  private updateSnapPreview(left: number | string, top: number | string, right: number | string, bottom: number | string, width: number | string, height: number | string): void {
    this.snapPreviewEl.style.left = typeof left === "number" ? `${left}px` : left;
    this.snapPreviewEl.style.top = typeof top === "number" ? `${top}px` : top;
    this.snapPreviewEl.style.right = typeof right === "number" ? `${right}px` : right;
    this.snapPreviewEl.style.bottom = typeof bottom === "number" ? `${bottom}px` : bottom;
    this.snapPreviewEl.style.width = typeof width === "number" ? `${width}px` : width;
    this.snapPreviewEl.style.height = typeof height === "number" ? `${height}px` : height;
    this.snapPreviewEl.classList.add("visible");
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
          if (!this.settings.collapsed && (!this.settings.snapMode || this.settings.snapMode === "none")) {
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
