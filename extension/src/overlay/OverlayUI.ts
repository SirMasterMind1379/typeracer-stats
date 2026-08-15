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
    hideLobbySocials: true,
    enableSnapping: true,
    autoMinimizeOnRace: false,
    autoHideTopBar: false,
    transparentOverlay: false,
    wideMode: false,
    hideCursorWhileTyping: false,
    disableRacerPopupsDuringRace: false,
    snapMode: "none",
    dimensions: { width: 340, height: 420 },
    dockedWidth: 360,
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
    // Docked sidebars cannot be collapsed
    if (this.settings.snapMode && this.settings.snapMode !== "none") return;
    if (this.settings.collapsed === collapsed) return;
    this.settings.collapsed = collapsed;
    this.containerEl.classList.toggle("collapsed", collapsed);
    const collapseBtn = this.shadowRoot.getElementById("tr-btn-collapse");
    if (collapseBtn) {
      collapseBtn.textContent = collapsed ? "＋" : "－";
    }
    if (collapsed) {
      this.closeSettings();
    }
    this.saveSettings();
  }

  public isAutoMinimizeEnabled(): boolean {
    // Snapped sidebars do not block the central racetrack, so only auto-minimize when free-floating
    if (this.settings.snapMode && this.settings.snapMode !== "none") {
      return false;
    }
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

    // Transparency only applies when free-floating (not docked)
    const isSnapped = this.settings.snapMode && this.settings.snapMode !== "none";
    this.containerEl.classList.toggle("transparent", !isSnapped && !!this.settings.transparentOverlay);

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
    if (this.settings.enableSnapping !== false && snap !== "none") {
      this.applySnap(snap);
    } else {
      if (this.settings.position) {
        this.containerEl.style.left = `${this.settings.position.x}px`;
        this.containerEl.style.top = `${this.settings.position.y}px`;
        this.containerEl.style.right = "auto";
      }
      if (this.settings.dimensions?.width) {
        this.containerEl.style.width = `${this.settings.dimensions.width}px`;
      }
      if (this.settings.dimensions?.height && !this.settings.collapsed) {
        this.containerEl.style.height = `${this.settings.dimensions.height}px`;
      }
    }
  }

  private applyBodyMargin(side: "left" | "right", width: number): void {
    document.documentElement.classList.remove("tr-docked-left", "tr-docked-right");
    document.body.classList.remove("tr-docked-left", "tr-docked-right");

    document.documentElement.style.setProperty("--tr-dock-width", `${width}px`);
    document.body.style.setProperty("--tr-dock-width", `${width}px`);

    if (side === "left") {
      document.documentElement.classList.add("tr-docked-left");
      document.body.classList.add("tr-docked-left");
    } else {
      document.documentElement.classList.add("tr-docked-right");
      document.body.classList.add("tr-docked-right");
    }
  }

  private clearBodyMargin(): void {
    document.documentElement.classList.remove("tr-docked-left", "tr-docked-right");
    document.body.classList.remove("tr-docked-left", "tr-docked-right");
    document.documentElement.style.removeProperty("--tr-dock-width");
    document.body.style.removeProperty("--tr-dock-width");
  }

  private clearDockClasses(): void {
    this.containerEl.classList.remove("docked-left", "docked-right");
  }

  private applySnap(mode: NonNullable<OverlaySettings["snapMode"]>): void {
    this.settings.snapMode = mode;
    const isSnapped = mode !== "none";

    // Disable transparency and ensure overlay is expanded when docked
    this.containerEl.classList.toggle("transparent", !isSnapped && !!this.settings.transparentOverlay);
    this.containerEl.classList.remove("collapsed");

    const dockW = this.settings.dockedWidth
      ? Math.max(260, Math.min(Math.floor(window.innerWidth * 0.6), this.settings.dockedWidth))
      : 360;

    if (mode === "left-dock") {
      this.containerEl.classList.remove("docked-right");
      this.containerEl.classList.add("docked-left");
      this.containerEl.style.left = "0px";
      this.containerEl.style.right = "auto";
      this.containerEl.style.top = "0px";
      this.containerEl.style.bottom = "0px";
      this.containerEl.style.width = `${dockW}px`;
      this.containerEl.style.height = "100vh";
      this.applyBodyMargin("left", dockW);
    } else if (mode === "right-dock") {
      this.containerEl.classList.remove("docked-left");
      this.containerEl.classList.add("docked-right");
      this.containerEl.style.left = "auto";
      this.containerEl.style.right = "0px";
      this.containerEl.style.top = "0px";
      this.containerEl.style.bottom = "0px";
      this.containerEl.style.width = `${dockW}px`;
      this.containerEl.style.height = "100vh";
      this.applyBodyMargin("right", dockW);
    } else {
      this.clearDockClasses();
      this.clearBodyMargin();
      this.containerEl.style.bottom = "auto";
      const floatW = this.settings.dimensions?.width || 340;
      const floatH = this.settings.dimensions?.height || 420;
      this.containerEl.style.width = `${floatW}px`;
      this.containerEl.style.height = `${floatH}px`;
      if (this.settings.position) {
        this.containerEl.style.left = `${this.settings.position.x}px`;
        this.containerEl.style.top = `${this.settings.position.y}px`;
        this.containerEl.style.right = "auto";
      }
    }

    this.saveSettings();
  }

  private buildUI(): void {
    const isSnapped = this.settings.snapMode && this.settings.snapMode !== "none";
    this.containerEl = document.createElement("div");
    this.containerEl.className = `tr-overlay-container ${this.settings.collapsed ? "collapsed" : ""} ${!isSnapped && this.settings.transparentOverlay ? "transparent" : ""}`;

    if (isSnapped) {
      const dockW = this.settings.dockedWidth || 360;
      this.containerEl.style.width = `${dockW}px`;
      this.containerEl.style.height = "100vh";
    } else {
      if (this.settings.dimensions?.width) {
        this.containerEl.style.width = `${this.settings.dimensions.width}px`;
      }
      if (this.settings.dimensions?.height && !this.settings.collapsed) {
        this.containerEl.style.height = `${this.settings.dimensions.height}px`;
      }
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
    const hideSocials = this.settings.hideLobbySocials ?? true;
    const enableSnapping = this.settings.enableSnapping ?? true;
    const autoMin = this.settings.autoMinimizeOnRace ?? false;
    const autoTopBar = this.settings.autoHideTopBar ?? false;
    const transparentOverlay = this.settings.transparentOverlay ?? false;
    const wideMode = this.settings.wideMode ?? false;
    const hideCursor = this.settings.hideCursorWhileTyping ?? false;
    const blockPopups = this.settings.disableRacerPopupsDuringRace ?? false;

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

        <!-- Placed right after Hide Premium Upsells -->
        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Hide Social Links in Race Box</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-hidelobbysocials" ${hideSocials ? "checked" : ""}>
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
          <span>TypeRacer Wide Track Mode</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-widemode" ${wideMode ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Hide Mouse Cursor While Typing</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-hidecursor" ${hideCursor ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <div class="tr-setting-row" style="margin-top: 6px;">
          <span>Block Racer Popups During Race</span>
          <label class="tr-switch">
            <input type="checkbox" id="tr-set-blockpopups" ${blockPopups ? "checked" : ""}>
            <span class="tr-slider"></span>
          </label>
        </div>

        <!-- Window Snapping & Docking Master Setting -->
        <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
          <div class="tr-setting-row">
            <span style="font-weight: 700; color: #ef4444;">Enable Side-Docking & Snapping</span>
            <label class="tr-switch">
              <input type="checkbox" id="tr-set-enablesnapping" ${enableSnapping ? "checked" : ""}>
              <span class="tr-slider"></span>
            </label>
          </div>

          <!-- Floating Mode Sub-Settings (Only active when window is floating) -->
          <div style="margin-top: 6px; padding-left: 10px; border-left: 2px solid rgba(239, 68, 68, 0.4); display: flex; flex-direction: column; gap: 6px;">
            <div class="tr-setting-row">
              <span style="font-size: 10.5px;">Auto-Minimize During Race <em style="opacity: 0.6; font-size: 9.5px;">(Floating Only)</em></span>
              <label class="tr-switch">
                <input type="checkbox" id="tr-set-autominimize" ${autoMin ? "checked" : ""}>
                <span class="tr-slider"></span>
              </label>
            </div>

            <div class="tr-setting-row">
              <span style="font-size: 10.5px;">Window Transparency <em style="opacity: 0.6; font-size: 9.5px;">(Floating Only)</em></span>
              <label class="tr-switch">
                <input type="checkbox" id="tr-set-transparency" ${transparentOverlay ? "checked" : ""}>
                <span class="tr-slider"></span>
              </label>
            </div>
          </div>
        </div>

        <div class="tr-setting-row" style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
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

    const hideSocialsCheckbox = this.shadowRoot.getElementById("tr-set-hidelobbysocials") as HTMLInputElement;
    if (hideSocialsCheckbox) {
      hideSocialsCheckbox.addEventListener("change", () => {
        this.settings.hideLobbySocials = hideSocialsCheckbox.checked;
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

    const wideModeCheckbox = this.shadowRoot.getElementById("tr-set-widemode") as HTMLInputElement;
    if (wideModeCheckbox) {
      wideModeCheckbox.addEventListener("change", () => {
        this.settings.wideMode = wideModeCheckbox.checked;
        this.saveSettings();
      });
    }

    const hideCursorCheckbox = this.shadowRoot.getElementById("tr-set-hidecursor") as HTMLInputElement;
    if (hideCursorCheckbox) {
      hideCursorCheckbox.addEventListener("change", () => {
        this.settings.hideCursorWhileTyping = hideCursorCheckbox.checked;
        this.saveSettings();
      });
    }

    const blockPopupsCheckbox = this.shadowRoot.getElementById("tr-set-blockpopups") as HTMLInputElement;
    if (blockPopupsCheckbox) {
      blockPopupsCheckbox.addEventListener("change", () => {
        this.settings.disableRacerPopupsDuringRace = blockPopupsCheckbox.checked;
        this.saveSettings();
      });
    }

    const snappingCheckbox = this.shadowRoot.getElementById("tr-set-enablesnapping") as HTMLInputElement;
    if (snappingCheckbox) {
      snappingCheckbox.addEventListener("change", () => {
        this.settings.enableSnapping = snappingCheckbox.checked;
        if (!this.settings.enableSnapping && this.settings.snapMode !== "none") {
          this.applySnap("none");
        }
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

    const transparencyCheckbox = this.shadowRoot.getElementById("tr-set-transparency") as HTMLInputElement;
    if (transparencyCheckbox) {
      transparencyCheckbox.addEventListener("change", () => {
        this.settings.transparentOverlay = transparencyCheckbox.checked;
        const isSnapped = this.settings.snapMode && this.settings.snapMode !== "none";
        this.containerEl.classList.toggle("transparent", !isSnapped && this.settings.transparentOverlay);
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
        const floatW = this.settings.dimensions?.width || 340;
        const floatH = this.settings.dimensions?.height || 420;
        this.containerEl.style.width = `${floatW}px`;
        this.containerEl.style.height = `${floatH}px`;
        this.containerEl.classList.toggle("transparent", !!this.settings.transparentOverlay);
        offsetX = Math.floor(floatW / 2);
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

      // Check if snapping is enabled
      if (this.settings.enableSnapping === false) {
        currentSnapTarget = "none";
        this.snapPreviewEl.classList.remove("visible");
        return;
      }

      // Left & Right Side Snapping Only
      const isNearLeft = e.clientX < 50;
      const isNearRight = e.clientX > window.innerWidth - 50;
      const dockW = this.settings.dockedWidth || 360;

      if (isNearLeft) {
        currentSnapTarget = "left-dock";
        this.updateSnapPreview(0, 0, "auto", 0, dockW, window.innerHeight);
      } else if (isNearRight) {
        currentSnapTarget = "right-dock";
        this.updateSnapPreview(window.innerWidth - dockW, 0, "auto", 0, dockW, window.innerHeight);
      } else {
        currentSnapTarget = "none";
        this.snapPreviewEl.classList.remove("visible");
      }
    });

    window.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        this.snapPreviewEl.classList.remove("visible");

        if (this.settings.enableSnapping !== false && currentSnapTarget !== "none") {
          this.applySnap(currentSnapTarget);
        } else {
          const rect = this.containerEl.getBoundingClientRect();
          this.settings.position = { x: rect.left, y: rect.top };
          this.settings.snapMode = "none";
          this.containerEl.classList.toggle("transparent", !!this.settings.transparentOverlay);
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

          // If currently docked to the left, resizing right edge adjusts dock width dynamically
          if (this.settings.snapMode === "left-dock") {
            newW = Math.max(260, Math.min(Math.floor(window.innerWidth * 0.6), startW + dx));
            this.containerEl.style.width = `${newW}px`;
            this.containerEl.style.height = "100vh";
            this.containerEl.style.left = "0px";
            this.containerEl.style.top = "0px";
            this.containerEl.style.right = "auto";
            this.applyBodyMargin("left", newW);
            this.settings.dockedWidth = newW;
            return;
          }

          // If currently docked to the right, resizing left edge adjusts dock width dynamically
          if (this.settings.snapMode === "right-dock") {
            newW = Math.max(260, Math.min(Math.floor(window.innerWidth * 0.6), startW - dx));
            this.containerEl.style.width = `${newW}px`;
            this.containerEl.style.height = "100vh";
            this.containerEl.style.left = "auto";
            this.containerEl.style.right = "0px";
            this.containerEl.style.top = "0px";
            this.applyBodyMargin("right", newW);
            this.settings.dockedWidth = newW;
            return;
          }

          // Floating Resize
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
          const w = Math.round(entry.contentRect.width);
          const h = Math.round(entry.contentRect.height);
          if (w > 0) {
            if (this.settings.snapMode === "left-dock") {
              this.applyBodyMargin("left", w);
              this.settings.dockedWidth = w;
            } else if (this.settings.snapMode === "right-dock") {
              this.applyBodyMargin("right", w);
              this.settings.dockedWidth = w;
            } else if (!this.settings.collapsed && h > 0) {
              this.settings.dimensions = { width: w, height: h };
            }
          }
        }
      });
      ro.observe(this.containerEl);
    }
  }
}
