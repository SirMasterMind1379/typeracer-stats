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

    // 3. Apply Upsells Cleaner on startup for all subdomains
    const initialSettings = this.ui.getSettings();
    this.applyUpsellsCleaner(initialSettings.hideUpsells ?? true);

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
          .profileTable__row--upsell,
          .b-premium-upsell,
          .pt-16.justify-center.items-start.bg-black\\/50.flex.z-50.inset-0.fixed,
          .fixed.inset-0.z-50.flex.bg-black\\/50.items-start.justify-center.pt-16,
          div[class*="fixed"][class*="inset-0"][class*="z-50"][class*="bg-black/50"] {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
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

  private async handleUsernameChanged(username: string): Promise<void> {
    if (!username) return;
    this.activeUsername = username;
    this.ui.updateUsernameTitle(username);

    // Update settings if not set
    const settings = this.ui.getSettings();
    if (settings.username !== username) {
      settings.username = username;
      this.ui.saveSettings();
    }

    // Fetch QOTD Status from API
    this.isQotdDoneFromApi = await this.streakTracker.checkQOTDFromAPI(username);

    // Sync user's real recent race history from TypeRacer API
    await this.quoteStore.syncFromAPI(username);

    // Refresh overlay UI with synced data
    await this.refreshOverlayData();
  }

  private async refreshOverlayData(highlightNew = false): Promise<void> {
    const races = await this.quoteStore.getRecentRaces(200);
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

  private async handleQuoteLoaded(textId: number, quoteText: string): Promise<void> {
    // Auto-minimize during race if enabled
    if (this.ui.isAutoMinimizeEnabled()) {
      this.ui.setCollapsed(true);
    }

    // Look up previous record for this text
    this.currentQuoteRecord = await this.quoteStore.getQuoteHistory(textId);
    this.quoteHistoryWidget.renderPreRaceQuote(this.currentQuoteRecord, quoteText);
  }

  private async handleRaceCompleted(race: ExtensionRace): Promise<void> {
    const username = this.activeUsername || "local_user";

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
      }, 1200);
    }
  }
}

// Auto-boot overlay when script loads on *.typeracer.com
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new TypeRacerOverlayApp());
} else {
  new TypeRacerOverlayApp();
}
