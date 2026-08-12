// Chrome Extension Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log("[TypeRacer Overlay] Service Worker installed.");
  chrome.alarms.create("CHECK_STREAK_ALARM", { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "CHECK_STREAK_ALARM") {
    checkResetNotification();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "SHOW_NOTIFICATION") {
    try {
      chrome.notifications.create(message.id || "tr-notification", {
        type: "basic",
        iconUrl: "icons/icon48.jpg",
        title: message.title || "TypeRacer Stats Alert",
        message: message.message || "",
        priority: 2,
      });
      sendResponse({ success: true });
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (message.type === "FETCH_RACES") {
    fetchRacesForUser(message.username)
      .then((races) => sendResponse({ success: true, races }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === "CHECK_QOTD") {
    checkQOTDForUser(message.username)
      .then((qotdDone) => sendResponse({ success: true, qotdDone }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  return false;
});

async function fetchRacesForUser(username: string): Promise<any[]> {
  if (!username) return [];

  // 1. Try Primary JSON API first
  try {
    const apiRes = await fetch(`https://data.typeracer.com/api/v1/racers/${encodeURIComponent(username)}/races?universe=play&n=50`);
    if (apiRes.ok) {
      const json = await apiRes.json();
      const rawList = Array.isArray(json) ? json : [];
      if (rawList.length > 0) {
        return rawList.map((r: any) => ({
          id: String(r.rid),
          date: r.t ? (typeof r.t === "number" ? new Date(r.t * 1000).toISOString() : String(r.t)) : new Date().toISOString(),
          speed: Math.round(Number(r.wpm)),
          accuracy: r.acc != null ? Number((r.acc * (r.acc <= 1 ? 100 : 1)).toFixed(1)) : 100,
          points: r.pts != null ? Number(r.pts) : null,
          rank: r.r || 1,
          totalRacers: r.nr || 1,
          textId: r.tid || 0,
          won: r.r === 1,
          mode: r.gn || r.mode || "multiplayer",
        }));
      }
    }
  } catch (err) {
    console.warn("[Background] Primary API fetch failed, trying pit scraper fallback:", err);
  }

  // 2. Fallback: Scrape Pit Race History Page
  try {
    const pitRes = await fetch(`https://data.typeracer.com/pit/race_history?user=${encodeURIComponent(username)}&n=50`);
    if (pitRes.ok) {
      const html = await pitRes.text();
      const rows = [...html.matchAll(/<div class="Scores__Table__Row">([\s\S]*?)<\/div>\s*<\/div>/g)];
      const scraped: any[] = [];

      for (const r of rows) {
        const content = r[1];
        const numMatch = content.match(/href="\/pit\/result\?id=[^"]*?\|(\d+)"/i) || content.match(/\|(\d+)"/);
        const wpmMatch = content.match(/(\d+)\s*WPM/i);
        const accMatch = content.match(/([\d.]+)%/);
        const ptsMatch = content.match(/profileTableHeaderAvg">[\s\S]*?(\d+)/i);
        const dateMatch = content.match(/profileTableHeaderDate">[\s\S]*?([A-Z][a-z]{2}\s+\d+,\s+\d{4})/i);
        const rankMatch = content.match(/profileTableHeaderPoints">[\s\S]*?(\d+)\/(\d+)/i);
        const modeMatch = content.match(/profileTableHeaderRaces">[\s\S]*?([A-Za-z0-9\s]+)/i);

        if (wpmMatch) {
          const wpm = parseInt(wpmMatch[1], 10);
          const acc = accMatch ? parseFloat(accMatch[1]) : 98.0;
          const rank = rankMatch ? parseInt(rankMatch[1], 10) : 1;
          const nr = rankMatch ? parseInt(rankMatch[2], 10) : 5;
          const dateStr = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
          const mode = modeMatch ? modeMatch[1].trim() : "multiplayer";

          scraped.push({
            id: `pit_${numMatch ? numMatch[1] : Math.random()}`,
            date: dateStr,
            speed: wpm,
            accuracy: acc,
            points: ptsMatch ? parseInt(ptsMatch[1], 10) : null,
            rank,
            totalRacers: nr,
            textId: 0,
            won: rank === 1,
            mode,
          });
        }
      }
      if (scraped.length > 0) return scraped;
    }
  } catch (err) {
    console.warn("[Background] Pit scraper fallback failed:", err);
  }

  return [];
}

async function checkQOTDForUser(username: string): Promise<boolean> {
  if (!username) return false;
  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Check API Competitions
    const compRes = await fetch(`https://data.typeracer.com/api/v2/competitions?universe=play&date=${todayStr}`);
    if (compRes.ok) {
      const comps = await compRes.json();
      const compList = Array.isArray(comps) ? comps : [];
      if (compList.length > 0 && compList[0].uid) {
        const resRes = await fetch(`https://data.typeracer.com/api/v2/competitions/results?uid=${compList[0].uid}`);
        if (resRes.ok) {
          const results = await resRes.json();
          const list = Array.isArray(results) ? results : [];
          if (list.some((r: any) => (r.username || r.u || "").toLowerCase() === username.toLowerCase())) {
            return true;
          }
        }
      }
    }

    // 2. Check Pit Profile Page for QOTD Badges or recent activity
    const profileRes = await fetch(`https://data.typeracer.com/pit/profile?user=${encodeURIComponent(username)}`);
    if (profileRes.ok) {
      const html = await profileRes.text();
      if (html.includes('data-badge="qotd_') || html.includes('Quote of the Day')) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  return false;
}

function checkResetNotification() {
  const now = new Date();
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  const secondsRemaining = Math.floor((nextReset.getTime() - now.getTime()) / 1000);

  if (secondsRemaining <= 3600 && secondsRemaining > 0) {
    chrome.storage.local.get(["tr_last_notification_date", "tr_races_today"], (res) => {
      const todayStr = now.toISOString().slice(0, 10);
      if (res.tr_last_notification_date !== todayStr) {
        const racesDone = res.tr_races_today || 0;
        if (racesDone < 10) {
          const remaining = 10 - racesDone;
          chrome.notifications.create("tr-1h-streak-reset", {
            type: "basic",
            iconUrl: "icons/icon48.jpg",
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
