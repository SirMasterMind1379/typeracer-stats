// Chrome Extension Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log("[TypeRacer Overlay] Extension Service Worker installed.");
  // Setup alarm for periodic 15-minute streak & notification check
  chrome.alarms.create("CHECK_STREAK_ALARM", { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "CHECK_STREAK_ALARM") {
    checkResetNotification();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SHOW_NOTIFICATION") {
    chrome.notifications.create(message.id || "tr-notification", {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: message.title || "TypeRacer Stats Alert",
      message: message.message || "",
      priority: 2,
    });
    sendResponse({ success: true });
  }
});

function checkResetNotification() {
  const now = new Date();
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  const secondsRemaining = Math.floor((nextReset.getTime() - now.getTime()) / 1000);

  // Check if within 1 hour (3600 seconds)
  if (secondsRemaining <= 3600 && secondsRemaining > 0) {
    chrome.storage.local.get(["tr_last_notification_date", "tr_races_today"], (res) => {
      const todayStr = now.toISOString().slice(0, 10);
      if (res.tr_last_notification_date !== todayStr) {
        const racesDone = res.tr_races_today || 0;
        if (racesDone < 10) {
          const remaining = 10 - racesDone;
          chrome.notifications.create("tr-1h-streak-reset", {
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "⏰ TypeRacer Streak Alert",
            message: `1 hour left before day reset! You need ${remaining} more race${remaining > 1 ? "s" : ""} to maintain your 10-race daily streak.`,
            priority: 2,
          });
          chrome.storage.local.set({ tr_last_notification_date: todayStr });
        }
      }
    });
  }
}
