import overlayCss from "./styles/overlay.css?raw";
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
    });

    // 2. Initialize Component Widgets
    this.quoteHistoryWidget = new QuoteHistoryWidget(this.ui.quoteWidgetEl);
    this.streakWidget = new StreakWidget(this.ui.streakWidgetEl);
    this.recentRacesWidget = new RecentRacesWidget(this.ui.racesWidgetEl);

    // 3. Request Notification Permission if setting enabled
    if (this.ui.getSettings().notifyOneHourBefore) {
      this.notifier.requestPermission();
    }

    // 4. Initial Render of Saved Races & Streak
    await this.refreshOverlayData();

    // 5. Start Countdown Timer Interval (Updates timer live every 1 second)
    this.startCountdownTimer();

    // 6. Attach TypeRacer Hook
    this.trHook = new TypeRacerHook({
      onQuoteLoaded: (textId, quoteText) => this.handleQuoteLoaded(textId, quoteText),
      onRaceCompleted: (race) => this.handleRaceCompleted(race),
    });

    console.log("[TypeRacer Overlay] Initialized successfully on play.typeracer.com!");
  }

  private async refreshOverlayData(highlightNew = false): Promise<void> {
    const races = await this.quoteStore.getRecentRaces(10);
    this.recentRacesWidget.render(races, highlightNew);

    const streakInfo = this.streakTracker.calculateStreakInfo(races);
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
      const races = await this.quoteStore.getRecentRaces(10);
      const streakInfo = this.streakTracker.calculateStreakInfo(races);
      this.streakWidget.render(streakInfo);
    }, 1000);
  }

  private async handleQuoteLoaded(textId: number, quoteText: string): Promise<void> {
    // Look up previous record for this text
    this.currentQuoteRecord = await this.quoteStore.getQuoteHistory(textId);
    this.quoteHistoryWidget.renderPreRaceQuote(this.currentQuoteRecord, quoteText);
  }

  private async handleRaceCompleted(race: ExtensionRace): Promise<void> {
    // 1. Save race to QuoteStore (IndexedDB & memory)
    await this.quoteStore.saveRace(race);

    // 2. Render post-race performance comparison delta
    this.quoteHistoryWidget.renderPostRaceDelta(race, this.currentQuoteRecord);

    // 3. Refresh recent races list & streak widget with smooth animation
    await this.refreshOverlayData(true);
  }
}

// Auto-boot overlay when script loads on play.typeracer.com
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new TypeRacerOverlayApp());
} else {
  new TypeRacerOverlayApp();
}
