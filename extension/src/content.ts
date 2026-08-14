import overlayCss from "./styles/overlay.css";
import type { ExtensionRace, QuoteHistoryRecord, StreakInfo } from "./types";
import { QuoteStore } from "./core/QuoteStore";
import { StreakTracker } from "./core/StreakTracker";
import { Notifier } from "./core/Notifier";
import { TypeRacerHook } from "./core/TypeRacerHook";
import { OverlayUI } from "./overlay/OverlayUI";
import { RecentRacesWidget } from "./overlay/RecentRacesWidget";
import { StreakWidget } from "./overlay/StreakWidget";
import { QuoteHistoryWidget } from "./overlay/QuoteHistoryWidget";

class TypeRacerOverlayApp {
  private quoteStore: QuoteStore;
  private streakTracker: StreakTracker;
  private notifier: Notifier;
  private ui!: OverlayUI;

  private recentRacesWidget!: RecentRacesWidget;
  private streakWidget!: StreakWidget;
  private quoteHistoryWidget!: QuoteHistoryWidget;

  private trHook!: TypeRacerHook;
  private currentQuoteRecord: QuoteHistoryRecord | null = null;
  private timerInterval: any = null;
  private activeUsername: string = "";
  private isQotdDoneFromApi: boolean = false;
  private isRaceActive: boolean = false;

  constructor() {
    this.quoteStore = new QuoteStore();
    this.streakTracker = new StreakTracker();
    this.notifier = new Notifier();

    this.init();
  }

  private async init(): Promise<void> {
    // 1. Mount Overlay UI inside ShadowDOM
    this.ui = new OverlayUI(overlayCss, (settings) => {
      if (settings.notifyOneHourBefore) {
        this.notifier.requestPermission();
      }
      this.applyUpsellsCleaner(settings.hideUpsells ?? true);
      this.applyTopBarAutoHide(settings.autoHideTopBar ?? false);
      this.applyWideMode(settings.wideMode ?? false);
      this.applyLobbySocialsCleaner(settings.hideLobbySocials ?? true);
      this.applyCompactLobbyButtons(settings.compactLobbyButtons ?? false);

      if (!settings.disableRacerPopupsDuringRace && this.isRaceActive) {
        document.documentElement.classList.remove("tr-suppress-racer-popups");
      }

      if (settings.username && settings.username !== this.activeUsername) {
        this.handleUsernameChanged(settings.username);
      }
    });

    // 2. Wire Manual Refresh/Reload Button Handler
    this.ui.setOnRefresh(async () => {
      const user = this.activeUsername || this.ui.getSettings().username;
      if (user) {
        await this.quoteStore.syncFromAPI(user);
        this.isQotdDoneFromApi = await this.streakTracker.checkQOTDFromAPI(user);
      }
      await this.refreshOverlayData(true);
    });

    // 3. Apply Initial Page Enhancements & Settings
    const initialSettings = this.ui.getSettings();
    this.initDockingStyles();
    this.applyUpsellsCleaner(initialSettings.hideUpsells ?? true);
    this.applyTopBarAutoHide(initialSettings.autoHideTopBar ?? false);
    this.applyWideMode(initialSettings.wideMode ?? false);
    this.applyLobbySocialsCleaner(initialSettings.hideLobbySocials ?? true);
    this.applyCompactLobbyButtons(initialSettings.compactLobbyButtons ?? false);
    this.initTypingCursorHider();
    this.initRacerTooltipSuppressor();

    // 4. Initialize Component Widgets
    this.quoteHistoryWidget = new QuoteHistoryWidget(this.ui.quoteWidgetEl);
    this.streakWidget = new StreakWidget(this.ui.streakWidgetEl);
    this.recentRacesWidget = new RecentRacesWidget(this.ui.racesWidgetEl);

    // 5. Request Notification Permission if setting enabled
    if (this.ui.getSettings().notifyOneHourBefore) {
      this.notifier.requestPermission();
    }

    // 6. Attach TypeRacer Hook for DOM / Network Intercepts & Username Detection
    this.trHook = new TypeRacerHook({
      onQuoteLoaded: (textId, quoteText) => this.handleQuoteLoaded(textId, quoteText),
      onRaceStarted: () => this.handleRaceStarted(),
      onRaceCompleted: (race) => this.handleRaceCompleted(race),
      onUsernameDetected: (user) => this.handleUsernameChanged(user),
    });

    // 7. Detect Username from DOM / Cookies / Settings
    const settingsUsername = this.ui.getSettings().username;
    const domUsername = this.trHook.detectUsername();
    const effectiveUsername = domUsername || settingsUsername || "";

    if (effectiveUsername) {
      await this.handleUsernameChanged(effectiveUsername);
    } else {
      await this.refreshOverlayData();
    }

    // 8. Start Countdown Timer Interval (Updates timer live every 1 second)
    this.startCountdownTimer();

    // 9. Window Focus / Visibility change auto-refresh
    window.addEventListener("focus", () => {
      if (this.activeUsername) {
        this.quoteStore.syncFromAPI(this.activeUsername).then(() => {
          this.refreshOverlayData();
        });
      }
    });

    console.log("[TypeRacer Overlay] Initialized successfully on *.typeracer.com!");
  }

  private initDockingStyles(): void {
    let style = document.getElementById("tr-docking-layout-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "tr-docking-layout-style";
      style.textContent = `
        /* Dynamic Docking Layout Adjustment Styles with 16px Natural Breathing Gap */
        html.tr-docked-left, body.tr-docked-left {
          margin-left: calc(var(--tr-dock-width, 360px) + 16px) !important;
          margin-right: 0 !important;
          width: calc(100vw - var(--tr-dock-width, 360px) - 16px) !important;
          max-width: calc(100vw - var(--tr-dock-width, 360px) - 16px) !important;
          box-sizing: border-box !important;
          transition: margin 0.15s ease, width 0.15s ease !important;
        }

        html.tr-docked-right, body.tr-docked-right {
          margin-right: calc(var(--tr-dock-width, 360px) + 16px) !important;
          margin-left: 0 !important;
          width: calc(100vw - var(--tr-dock-width, 360px) - 16px) !important;
          max-width: calc(100vw - var(--tr-dock-width, 360px) - 16px) !important;
          box-sizing: border-box !important;
          transition: margin 0.15s ease, width 0.15s ease !important;
        }

        html.tr-docked-left #root,
        html.tr-docked-left #__next,
        html.tr-docked-left main,
        html.tr-docked-left .main-view,
        html.tr-docked-left .main-content,
        html.tr-docked-left div[class*="min-h-screen"],
        html.tr-docked-right #root,
        html.tr-docked-right #__next,
        html.tr-docked-right main,
        html.tr-docked-right .main-view,
        html.tr-docked-right .main-content,
        html.tr-docked-right div[class*="min-h-screen"] {
          max-width: 100% !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        /* Center content nicely without forcing wide mode expansion when Wide Mode is OFF */
        html.tr-docked-left:not(.tr-wide-mode) .max-w-4xl,
        html.tr-docked-left:not(.tr-wide-mode) div[class*="max-w-4xl"],
        html.tr-docked-right:not(.tr-wide-mode) .max-w-4xl,
        html.tr-docked-right:not(.tr-wide-mode) div[class*="max-w-4xl"] {
          max-width: min(56rem, calc(100vw - var(--tr-dock-width, 360px) - 32px)) !important;
          width: 100% !important;
          margin-left: auto !important;
          margin-right: auto !important;
          box-sizing: border-box !important;
        }

        html.tr-docked-left .xl\\:mr-80,
        html.tr-docked-left div[class*="xl:mr-80"],
        html.tr-docked-left div[class*="xl:ml-auto"],
        html.tr-docked-right .xl\\:mr-80,
        html.tr-docked-right div[class*="xl:mr-80"],
        html.tr-docked-right div[class*="xl:ml-auto"] {
          margin-right: auto !important;
          margin-left: auto !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private initTypingCursorHider(): void {
    let style = document.getElementById("tr-typing-cursor-hider-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "tr-typing-cursor-hider-style";
      style.textContent = `
        /* Hide mouse cursor when typing on TypeRacer */
        .tr-hide-cursor, .tr-hide-cursor * {
          cursor: none !important;
        }
      `;
      document.head.appendChild(style);
    }

    let isCursorHidden = false;

    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.ui.getSettings().hideCursorWhileTyping) return;
      if (["Shift", "Control", "Alt", "Meta", "Escape", "Tab", "CapsLock"].includes(e.key)) return;
      if (!isCursorHidden) {
        document.documentElement.classList.add("tr-hide-cursor");
        isCursorHidden = true;
      }
    }, true);

    window.addEventListener("mousemove", () => {
      if (isCursorHidden) {
        document.documentElement.classList.remove("tr-hide-cursor");
        isCursorHidden = false;
      }
    }, true);
  }

  private initRacerTooltipSuppressor(): void {
    let style = document.getElementById("tr-racer-tooltip-suppressor-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "tr-racer-tooltip-suppressor-style";
      style.textContent = `
        /* Disable racer stats hover popups during race to avoid blocking text */
        .tr-suppress-racer-popups .cursor-help,
        .tr-suppress-racer-popups [class*="cursor-help"],
        .tr-suppress-racer-popups .gwt-PopupPanel:not([class*="theme"]):not([class*="Theme"]),
        .tr-suppress-racer-popups div[class*="popup"]:not([class*="theme"]):not([class*="Theme"]),
        .tr-suppress-racer-popups div[class*="tooltip"]:not([class*="theme"]):not([class*="Theme"]),
        .tr-suppress-racer-popups div[class*="Tooltip"]:not([class*="theme"]):not([class*="Theme"]) {
          pointer-events: none !important;
          user-select: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private applyLobbySocialsCleaner(hideSocials: boolean): void {
    let styleEl = document.getElementById("tr-hide-lobby-socials-style");

    if (hideSocials) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-hide-lobby-socials-style";
        styleEl.textContent = `
          /* Hide Social Media Links & Containers inside Main Race Box / Lobby Card */
          .mainMenu a[href*="discord"],
          .mainMenu a[href*="tiktok"],
          .mainMenu a[href*="twitter"],
          .mainMenu a[href*="facebook"],
          .mainMenu a[href*="youtube"],
          .mainMenu a[href*="reddit"],
          .mainMenu a[href*="instagram"],
          .mainMenu div[class*="social"],
          .main-view a[href*="discord"],
          .main-view a[href*="tiktok"],
          .main-view a[href*="twitter"],
          .main-view a[href*="facebook"],
          .main-view a[href*="youtube"],
          .main-view a[href*="reddit"],
          .main-view a[href*="instagram"],
          div[class*="bg-card-background"] .flex.flex-row.gap-4:has(a[href*="discord"]),
          div[class*="bg-card-background"] .flex.flex-row.gap-4:has(a[href*="tiktok"]),
          div[class*="bg-card-background"] .flex.flex-row.gap-4:has(a[aria-label="TikTok"]),
          div[class*="bg-card-background"] .flex.flex-row.gap-4:has(a[aria-label="Discord"]),
          div[class*="border-card-border"] .flex.flex-row.gap-4:has(a[href*="discord"]),
          div[class*="border-card-border"] .flex.flex-row.gap-4:has(a[href*="tiktok"]),
          div[class*="bg-card-background"] a[href*="discord"],
          div[class*="bg-card-background"] a[href*="tiktok"],
          div[class*="bg-card-background"] a[href*="facebook"],
          div[class*="bg-card-background"] a[href*="youtube"],
          div[class*="bg-card-background"] a[href*="twitter"],
          div[class*="bg-card-background"] a[href*="shockwavegames"],
          div[class*="bg-card-background"] a[aria-label="Discord"],
          div[class*="bg-card-background"] a[aria-label="TikTok"],
          div[class*="bg-card-background"] a[aria-label="Facebook"],
          div[class*="bg-card-background"] a[aria-label="YouTube"],
          div[class*="bg-card-background"] a[aria-label="Twitter"],
          div[class*="card"] a[href*="discord.gg"],
          div[class*="card"] a[href*="tiktok.com"],
          div[class*="card"] a[href*="twitter.com"],
          div[class*="card"] a[href*="facebook.com"],
          div[class*="card"] a[href*="youtube.com"],
          div[class*="card"] a[href*="reddit.com"],
          div[class*="card"] a[href*="instagram.com"],
          div[class*="rounded"] a[href*="discord.gg"],
          div[class*="rounded"] a[href*="tiktok.com"],
          div[class*="rounded"] a[href*="twitter.com"],
          div[class*="rounded"] a[href*="facebook.com"],
          div[class*="rounded"] a[href*="youtube.com"] {
            display: none !important;
            visibility: hidden !important;
          }

          /* Explicitly preserve bottom footer socials intact */
          footer a,
          footer a[href*="tiktok"],
          div[class*="footer"] a,
          div[class*="footer"] a[href*="tiktok"] {
            display: inline-flex !important;
            visibility: visible !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  private applyCompactLobbyButtons(compact: boolean): void {
    let styleEl = document.getElementById("tr-compact-lobby-style");

    if (compact) {
      document.documentElement.classList.add("tr-compact-lobby");
      document.body.classList.add("tr-compact-lobby");

      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-compact-lobby-style";
        styleEl.textContent = `
          /* Pure CSS Side-by-Side Lobby & QOTD Cards - Zero DOM Re-parenting (React Safe!) */
          html.tr-compact-lobby div.relative.w-full.flex.flex-col.gap-4:has(div[style*="bg_qotd"]),
          html.tr-compact-lobby div[class*="flex-col"]:has(> div[class*="bg-card-background"] div[style*="bg_qotd"]),
          html.tr-compact-lobby div[class*="flex-col"]:has(> div[class*="bg-card-background"]:has(div[style*="bg_qotd"])) {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
            gap: 16px !important;
            align-items: stretch !important;
          }

          html.tr-compact-lobby div[class*="bg-card-background"]:has(div[style*="bg_qotd"]),
          html.tr-compact-lobby div[class*="bg-card-background"]:has(a[href*="discord"]),
          html.tr-compact-lobby div[class*="bg-card-background"]:has(button) {
            height: 100% !important;
            margin: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      document.documentElement.classList.remove("tr-compact-lobby");
      document.body.classList.remove("tr-compact-lobby");
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  private applyUpsellsCleaner(hideUpsells: boolean): void {
    let styleEl = document.getElementById("tr-clean-upsells-style");

    if (hideUpsells) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-clean-upsells-style";
        styleEl.textContent = `
          /* TypeRacer Premium Upsell & Ad Cleaner (Excluding Theme Pickers & Dialogs) */
          .premiumBanner,
          .sidebarAd,
          .ad-container,
          #ad_container,
          .sponsorBanner,
          .t-promo,
          .t-ad,
          #t-promo,
          .gwt-Anchor[href*="premium"]:not([class*="theme"]):not([class*="Theme"]),
          .gwt-Anchor[href*="upgrade"]:not([class*="theme"]):not([class*="Theme"]),
          .gwt-Anchor[href*="subscribe"]:not([class*="theme"]):not([class*="Theme"]),
          a[href*="/premium"]:not([class*="theme"]):not([class*="Theme"]),
          a[href*="/upgrade"]:not([class*="theme"]):not([class*="Theme"]),
          a[href*="/subscribe"]:not([class*="theme"]):not([class*="Theme"]),
          a[href*="typeracer.com/premium"]:not([class*="theme"]):not([class*="Theme"]),
          a[href*="typeracer.com/upgrade"]:not([class*="theme"]):not([class*="Theme"]),
          iframe[src*="doubleclick"],
          iframe[src*="googlesyndication"],
          .pitProfileHeader__premiumBadge,
          .rankTable-upsell,
          .profileTableHeader__premium,
          div[class*="upsell"]:not([class*="theme"]):not([class*="Theme"]),
          div[class*="adBanner"]:not([class*="theme"]):not([class*="Theme"]) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }

          /* Explicitly protect Choose Theme Dialog, Modal & Theme Picker Elements */
          div[class*="theme"],
          div[class*="Theme"],
          div[class*="themePicker"],
          div[class*="ThemePicker"],
          div[class*="theme-modal"],
          div[class*="theme-picker"],
          div[class*="theme-selector"],
          div[class*="ThemeModal"],
          div[id*="theme"],
          div[id*="Theme"],
          div[aria-label*="theme"],
          div[aria-label*="Theme"],
          button[class*="theme"],
          button[class*="Theme"],
          a[class*="theme"],
          a[class*="Theme"] {
            display: revert !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  private applyTopBarAutoHide(autoHide: boolean): void {
    let styleEl = document.getElementById("tr-autohide-topbar-style");

    if (autoHide) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-autohide-topbar-style";
        styleEl.textContent = `
          /* TypeRacer Auto-Hide Top Navigation Bar (Reveals on Hover) */
          header,
          .top-bar,
          .header,
          .nav-bar,
          nav,
          div[class*="header"],
          div[class*="topbar"],
          div[class*="TopBar"],
          div[class*="navbar"] {
            opacity: 0 !important;
            max-height: 8px !important;
            overflow: hidden !important;
            transition: opacity 0.25s ease, max-height 0.3s ease !important;
          }

          header:hover,
          .top-bar:hover,
          .header:hover,
          .nav-bar:hover,
          nav:hover,
          div[class*="header"]:hover,
          div[class*="topbar"]:hover,
          div[class*="TopBar"]:hover,
          div[class*="navbar"]:hover {
            opacity: 1 !important;
            max-height: 120px !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  private applyWideMode(wideMode: boolean): void {
    let styleEl = document.getElementById("tr-wide-mode-style");

    if (wideMode) {
      document.documentElement.classList.add("tr-wide-mode");
      document.body.classList.add("tr-wide-mode");

      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-wide-mode-style";
        styleEl.textContent = `
          /* TypeRacer Wide Track Mode (Expands fully across available space without going under extension) */
          html.tr-wide-mode .max-w-4xl,
          html.tr-wide-mode div[class*="max-w-4xl"],
          html.tr-wide-mode .main-content,
          html.tr-wide-mode .racetrackContainer,
          html.tr-wide-mode .main-view,
          html.tr-wide-mode div[class*="main-content"],
          html.tr-wide-mode div[class*="racetrackContainer"],
          .max-w-4xl,
          div[class*="max-w-4xl"],
          .main-content,
          .racetrackContainer,
          .main-view {
            max-width: calc(100vw - var(--tr-dock-width, 0px) - 32px) !important;
            width: calc(100vw - var(--tr-dock-width, 0px) - 32px) !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .xl\\:mr-80,
          div[class*="xl:mr-80"],
          div[class*="xl:ml-auto"] {
            margin-right: auto !important;
            margin-left: auto !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      document.documentElement.classList.remove("tr-wide-mode");
      document.body.classList.remove("tr-wide-mode");
      if (styleEl) {
        styleEl.remove();
      }
    }
  }

  private async handleUsernameChanged(newUsername: string): Promise<void> {
    if (this.activeUsername === newUsername) return;
    this.activeUsername = newUsername;

    this.ui.updateUsernameTitle(newUsername);

    // Fetch QOTD status from API
    this.isQotdDoneFromApi = await this.streakTracker.checkQOTDFromAPI(newUsername);

    // Sync full race history from API
    await this.quoteStore.syncFromAPI(newUsername);

    // Refresh overlay UI
    await this.refreshOverlayData();
  }

  private async refreshOverlayData(highlightNew: boolean = false): Promise<void> {
    const races = await this.quoteStore.getRecentRaces(200);

    // If quote banner is displayed, validate it only pertains to latest race
    if (races.length > 0) {
      this.quoteHistoryWidget.validateAgainstLatestRace(races[0].id);
    }

    this.recentRacesWidget.render(races, highlightNew, this.activeUsername);

    const streakInfo = this.streakTracker.calculateStreakInfo(races, this.isQotdDoneFromApi);
    this.streakWidget.render(streakInfo);

    // Sync streak count to chrome storage for background alarm
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ tr_races_today: streakInfo.racesDoneToday });
    }

    // Check if 1-hour prior notification is required
    if (this.ui.getSettings().notifyOneHourBefore) {
      if (this.streakTracker.isNotificationNeeded(streakInfo)) {
        this.notifier.checkAndNotifyStreakReset(streakInfo.racesRemaining, streakInfo.qotdDone);
      }
    }
  }

  private startCountdownTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(async () => {
      const races = await this.quoteStore.getRecentRaces(200);
      const streakInfo = this.streakTracker.calculateStreakInfo(races, this.isQotdDoneFromApi);
      this.streakWidget.render(streakInfo);
    }, 1000);
  }

  private handleRaceStarted(): void {
    this.isRaceActive = true;

    // 1. Auto-minimize during race if enabled (floating mode only)
    if (this.ui.isAutoMinimizeEnabled()) {
      this.ui.setCollapsed(true);
    }

    // 2. Suppress racer hover tooltips during race if setting enabled
    if (this.ui.getSettings().disableRacerPopupsDuringRace) {
      document.documentElement.classList.add("tr-suppress-racer-popups");
    }

    // 3. Clear old post-race quote comparison banner when starting next race
    this.quoteHistoryWidget.clear();
    this.currentQuoteRecord = null;
  }

  private async handleQuoteLoaded(textId: number, quoteText: string): Promise<void> {
    // Auto-minimize during race if enabled (floating mode only)
    if (this.ui.isAutoMinimizeEnabled()) {
      this.ui.setCollapsed(true);
    }

    // Look up previous record for this text
    this.currentQuoteRecord = await this.quoteStore.getQuoteHistory(textId);
    this.quoteHistoryWidget.renderPreRaceQuote(this.currentQuoteRecord, quoteText);
  }

  private async handleRaceCompleted(race: ExtensionRace): Promise<void> {
    this.isRaceActive = false;
    const username = this.activeUsername || "local_user";

    // Restore racer tooltips on race completion
    document.documentElement.classList.remove("tr-suppress-racer-popups");

    // Auto-expand overlay on race completion if auto-minimize was active
    if (this.ui.isAutoMinimizeEnabled()) {
      this.ui.setCollapsed(false);
    }

    // 1. Save completed race to QuoteStore
    await this.quoteStore.saveRace(race, username);

    // 2. Render post-race performance comparison delta
    this.quoteHistoryWidget.renderPostRaceDelta(race, this.currentQuoteRecord);

    // 3. Check QOTD if this race was QOTD mode
    if (race.mode?.toLowerCase().includes("qotd")) {
      this.isQotdDoneFromApi = true;
    }

    // 4. Auto-refresh recent races list & streak widget with smooth animation
    await this.refreshOverlayData(true);

    // 5. Sync from API in background to ensure 100% server sync
    if (this.activeUsername) {
      setTimeout(() => {
        this.quoteStore.syncFromAPI(this.activeUsername).then(() => {
          this.refreshOverlayData();
        });
      }, 800);
    }
  }
}

// Auto-boot overlay when script loads on *.typeracer.com
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new TypeRacerOverlayApp());
} else {
  new TypeRacerOverlayApp();
}
