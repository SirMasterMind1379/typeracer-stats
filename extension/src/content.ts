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
    this.applyUpsellsCleaner(initialSettings.hideUpsells ?? true);
    this.applyTopBarAutoHide(initialSettings.autoHideTopBar ?? false);
    this.applyWideMode(initialSettings.wideMode ?? false);
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
        .tr-suppress-racer-popups .gwt-PopupPanel,
        .tr-suppress-racer-popups div[class*="popup"],
        .tr-suppress-racer-popups div[class*="tooltip"],
        .tr-suppress-racer-popups div[class*="Tooltip"] {
          pointer-events: none !important;
          user-select: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  private applyUpsellsCleaner(hideUpsells: boolean): void {
    let styleEl = document.getElementById("tr-clean-upsells-style");

    if (hideUpsells) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-clean-upsells-style";
        styleEl.textContent = `
          /* TypeRacer Premium Upsell, Ad & Account Upgrade Modal Overlay Cleaner */
          .premiumBanner,
          .sidebarAd,
          .ad-container,
          #ad_container,
          .sponsorBanner,
          .t-promo,
          .t-ad,
          #t-promo,
          .gwt-Anchor[href*="premium"],
          .gwt-Anchor[href*="upgrade"],
          .gwt-Anchor[href*="subscribe"],
          a[href*="/premium"],
          a[href*="/upgrade"],
          a[href*="/subscribe"],
          a[href*="typeracer.com/premium"],
          a[href*="typeracer.com/upgrade"],
          iframe[src*="doubleclick"],
          iframe[src*="googlesyndication"],
          .pitProfileHeader__premiumBadge,
          .rankTable-upsell,
          .profileTableHeader__premium,
          div[class*="upsell"],
          div[class*="adBanner"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            opacity: 0 !important;
            pointer-events: none !important;
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
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "tr-wide-mode-style";
        styleEl.textContent = `
          /* TypeRacer Wide Track Mode (Wider track layout) */
          .max-w-4xl,
          div[class*="max-w-4xl"],
          .main-content,
          .racetrackContainer,
          .main-view {
            max-width: 95vw !important;
            width: 95vw !important;
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
