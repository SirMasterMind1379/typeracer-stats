export class Notifier {
  private hasNotifiedToday = false;

  public async requestPermission(): Promise<boolean> {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      try {
        const res = await Notification.requestPermission();
        return res === "granted";
      } catch {
        return false;
      }
    }
    return true;
  }

  public notify(title: string, message: string, id: string = "tr-streak-alert"): void {
    // 1. Chrome Extension API check
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          type: "SHOW_NOTIFICATION",
          id,
          title,
          message,
        });
        return;
      } catch {
        // Fallthrough if content script isolated
      }
    }

    // 2. Userscript GM_notification check
    if (typeof GM_notification !== "undefined") {
      try {
        GM_notification({
          title,
          text: message,
          timeout: 10000,
        });
        return;
      } catch {
        // Fallthrough
      }
    }

    // 3. Web Notification API Fallback
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: message,
          icon: "https://play.typeracer.com/favicon.ico",
        });
      } catch (err) {
        console.warn("[TypeRacer Overlay] Web Notification failed:", err);
      }
    }
  }

  public checkAndNotifyStreakReset(racesRemaining: number, qotdDone: boolean): void {
    const todayStr = new Date().toISOString().slice(0, 10);
    const lastNotified = localStorage.getItem("tr_last_notification_date");

    if (lastNotified === todayStr) {
      return; // Already notified today
    }

    let alertParts: string[] = [];
    if (racesRemaining > 0) {
      alertParts.push(`${racesRemaining} race${racesRemaining > 1 ? "s" : ""} left for 10-race streak`);
    }
    if (!qotdDone) {
      alertParts.push("Quote of the Day pending");
    }

    if (alertParts.length > 0) {
      const msg = `1 hour left before day reset! ${alertParts.join(" & ")}.`;
      this.notify("⏰ TypeRacer Streak Alert", msg, "tr-1h-reset");
      localStorage.setItem("tr_last_notification_date", todayStr);
    }
  }
}
