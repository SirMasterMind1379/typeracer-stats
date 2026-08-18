import type { ExtensionRace } from "../types";
import { formatDisplayDate } from "../types";

export interface TypeRacerHookEvents {
  onQuoteLoaded: (textId: number, quoteText: string) => void;
  onRaceStarted?: () => void;
  onRaceCompleted: (race: ExtensionRace) => void;
  onUsernameDetected?: (username: string) => void;
}

export class TypeRacerHook {
  private events: TypeRacerHookEvents;
  private currentTextId: number = 0;
  private currentQuoteText: string = "";
  private observer: MutationObserver | null = null;
  private isRaceInProgress = false;
  private detectedUsername = "";
  private lastHandledRaceId: string = "";
  private lastHandledRaceTime: number = 0;
  private lastHandledWpm: number = 0;

  constructor(events: TypeRacerHookEvents) {
    this.events = events;
    this.initNetworkInterceptor();
    this.initDOMObserver();
    this.initClickListeners();
  }

  public detectUsername(): string {
    // 1. Check cached storage
    try {
      const stored = localStorage.getItem("tr_username");
      if (stored && stored.trim().length >= 2) return stored.trim();
    } catch {
      // ignore
    }

    // 2. Check profile link in header/DOM
    const profileLinks = document.querySelectorAll(
      "a[href*='/pit/profile?user='], a[href*='/pit/racer?user='], a[href*='/pit/race_history?user='], a[href*='/profile/'], a[href*='/racer/']"
    );
    for (const link of profileLinks) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/user=([a-zA-Z0-9_]+)/) || href.match(/(?:profile|racer)\/([a-zA-Z0-9_]+)/);
      if (match && match[1]) {
        try {
          localStorage.setItem("tr_username", match[1]);
        } catch {}
        return match[1];
      }
    }

    // 3. Check racer name DOM elements
    const userEl = document.querySelector(".racerProfileLink, .userName, .profileNav .name, .racerName, span[class*='userName'], div[class*='userName']");
    if (userEl && userEl.textContent) {
      const name = userEl.textContent.trim().replace(/^@/, "");
      if (name && !name.includes(" ") && name.length >= 2 && !name.toLowerCase().includes("guest")) {
        try {
          localStorage.setItem("tr_username", name);
        } catch {}
        return name;
      }
    }

    // 4. Check Cookies
    const cookieMatch = document.cookie.match(/(?:^|; )(?:tr_username|pt_user|username)=([^;]*)/);
    if (cookieMatch && cookieMatch[1]) {
      const name = decodeURIComponent(cookieMatch[1]).trim();
      if (name && name.length >= 2) return name;
    }

    return "";
  }

  private initClickListeners(): void {
    const START_TRIGGER_REGEX = /race\s*again|enter\s*a\s*typing\s*race|quote\s*of\s*the\s*day|practice\s*yourself|create\s*racetrack|race\s*your\s*friends|join\s*race|\bpractice\b/i;

    document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const btn = target.closest("button, a, div[role='button'], .gwt-Anchor, [class*='bg-success'], [class*='bg-brand'], [class*='bg-warning']");
      if (btn && btn.textContent) {
        const text = btn.textContent.trim();
        if (START_TRIGGER_REGEX.test(text)) {
          this.handleRaceStartCue();
        }
      }
    }, true);
  }

  private handleRaceStartCue(): void {
    this.isRaceInProgress = true;
    if (this.events.onRaceStarted) {
      this.events.onRaceStarted();
    }
  }

  private initNetworkInterceptor(): void {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch.apply(window, args);
      try {
        const clone = response.clone();
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
        if (url && (url.includes("/api/v1/racers/") || url.includes("data.typeracer.com"))) {
          const json = await clone.json();
          this.handleApiResponse(json);
        }
      } catch {
        // ignore
      }
      return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const hook = this;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as any)._tr_url = String(url);
      return originalOpen.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (body?: any) {
      this.addEventListener("load", function () {
        try {
          const url = (this as any)._tr_url;
          if (url && (url.includes("/api/") || url.includes("typeracer"))) {
            const resText = this.responseText;
            if (resText && resText.startsWith("{")) {
              const json = JSON.parse(resText);
              hook.handleApiResponse(json);
            }
          }
        } catch {
          // ignore
        }
      });
      return originalSend.apply(this, [body] as any);
    };
  }

  private handleApiResponse(data: any): void {
    if (!data) return;
    const raceList = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [data];
    for (const item of raceList) {
      if (item && item.wpm != null && item.rid != null) {
        const raceId = Number(item.rid) || Date.now();
        const raceWpm = Math.round(Number(item.wpm) * 10) / 10;
        if (this.lastHandledRaceId === String(raceId)) continue;
        if (Date.now() - this.lastHandledRaceTime < 5000 && Math.abs(this.lastHandledWpm - raceWpm) < 0.1) continue;

        this.lastHandledRaceId = String(raceId);
        this.lastHandledRaceTime = Date.now();
        this.lastHandledWpm = raceWpm;
        this.isRaceInProgress = false;

        const ts = item.t ? (typeof item.t === "number" && item.t < 1e12 ? item.t * 1000 : Number(item.t)) : Date.now();

        const isQotdItem =
          (item.gn && String(item.gn).toLowerCase().includes("qotd")) ||
          (item.mode && String(item.mode).toLowerCase().includes("qotd")) ||
          (item.universe && String(item.universe).toLowerCase().includes("qotd"));

        const mode = isQotdItem
          ? "qotd"
          : item.gn || item.mode || (item.universe === "play" ? "multiplayer" : item.universe) || "multiplayer";

        const race: ExtensionRace = {
          id: raceId,
          textId: item.tid || this.currentTextId || 0,
          wpm: Math.round(Number(item.wpm) * 10) / 10,
          accuracy: item.acc != null ? Math.round(Number(item.acc * (item.acc <= 1 ? 100 : 1)) * 10) / 10 : 100,
          points: item.pts != null ? Number(item.pts) : undefined,
          rank: item.r || 1,
          racers: item.nr || 5,
          timestamp: ts,
          dateStr: formatDisplayDate(ts),
          mode,
        };
        this.events.onRaceCompleted(race);
      }
    }
  }

  private initDOMObserver(): void {
    const checkDOM = () => {
      // 0. Check Username
      const user = this.detectUsername();
      if (user && user !== this.detectedUsername) {
        this.detectedUsername = user;
        if (this.events.onUsernameDetected) {
          this.events.onUsernameDetected(user);
        }
      }

      // 1. Detect active typing input or countdown (Race Start Cue)
      const activeInput = document.querySelector(
        "input.txtInput:not([disabled]), textarea.txtInput:not([disabled]), input[data-qa='game-input']:not([disabled]), .gameView input:not([disabled])"
      );
      const countdownBox = document.querySelector(".countdownPopup, .popupContent, [class*='countdown']");
      if ((activeInput || countdownBox) && !this.isRaceInProgress) {
        this.handleRaceStartCue();
      }

      // 2. Detect quote text & exact textId in game box
      const textContainer = document.querySelector(
        ".gameView .textPane, .gameView .unhandled, .gameView [data-qa='quote'], [class*='textPane'], [class*='unhandled']"
      );
      if (textContainer && textContainer.textContent) {
        const fullText = textContainer.textContent.trim();
        if (fullText && fullText !== this.currentQuoteText) {
          this.currentQuoteText = fullText;
          this.isRaceInProgress = true;

          // Search DOM for exact text_info link
          let tid = 0;
          const infoLinks = document.querySelectorAll("a[href*='text_info?id=']");
          for (const link of infoLinks) {
            const href = link.getAttribute("href") || "";
            const match = href.match(/id=(\d+)/);
            if (match && match[1]) {
              tid = parseInt(match[1], 10);
              break;
            }
          }
          if (!tid) {
            tid = this.hashString(fullText);
          }
          this.currentTextId = tid;
          this.events.onQuoteLoaded(tid, fullText);
        }
      }

      // 3. Detect Text ID if link loads after initial render
      if (this.currentTextId === 0 || this.currentTextId > 100000000) {
        const infoLinks = document.querySelectorAll("a[href*='text_info?id=']");
        for (const link of infoLinks) {
          const href = link.getAttribute("href") || "";
          const match = href.match(/id=(\d+)/);
          if (match && match[1]) {
            const realTid = parseInt(match[1], 10);
            if (realTid > 0 && realTid !== this.currentTextId) {
              this.currentTextId = realTid;
              this.events.onQuoteLoaded(realTid, this.currentQuoteText);
              break;
            }
          }
        }
      }

      // 4. Detect Race Completion (Race Again button, Pit Result link, or Rank Panel)
      let raceAgainBtn: HTMLElement | null = null;
      const allButtons = document.querySelectorAll("button, a.raceAgainLink, a[class*='raceAgain'], .raceAgainLink");
      for (const btn of allButtons) {
        if (btn.textContent && btn.textContent.toLowerCase().includes("race again")) {
          raceAgainBtn = btn as HTMLElement;
          break;
        }
      }

      const resultLink = document.querySelector("a[href*='/pit/result?id='], a[href*='result?id=']");
      const rankPanel = document.querySelector(".rankPanel, .tblScore, .popup .wpmScore, .gameView .rank, [data-qa='race-results']");

      const isFinished = raceAgainBtn != null || resultLink != null || rankPanel != null;

      if (isFinished && (this.isRaceInProgress || Date.now() - this.lastHandledRaceTime > 4000)) {
        let raceId: number | string = "";
        if (resultLink) {
          const href = resultLink.getAttribute("href") || "";
          const match = href.match(/id=([^&]+)/);
          if (match) raceId = match[1];
        }

        if (!raceId) {
          raceId = Date.now();
        }

        if (this.lastHandledRaceId !== String(raceId)) {
          // Extract WPM & Accuracy
          const wpmMatch = document.body.innerText.match(/(\d+(?:\.\d+)?)\s*wpm/i);
          const accMatch = document.body.innerText.match(/(\d+(?:\.\d+)?)\s*%\s*accuracy/i);

          if (wpmMatch) {
            const wpm = parseFloat(wpmMatch[1]);
            const acc = accMatch ? parseFloat(accMatch[1]) : 100;
            const roundedWpm = Math.round(wpm * 10) / 10;

            if (Date.now() - this.lastHandledRaceTime < 5000 && Math.abs(this.lastHandledWpm - roundedWpm) < 0.1) {
              return; // Already captured by API intercept
            }

            this.isRaceInProgress = false;
            this.lastHandledRaceId = String(raceId);
            this.lastHandledRaceTime = Date.now();
            this.lastHandledWpm = roundedWpm;

            const numId = typeof raceId === "number" ? raceId : parseInt(String(raceId).replace(/\D/g, ""), 10) || Date.now();
            const now = Date.now();

            const isQotd =
              window.location.search.includes("universe=qotd") ||
              window.location.hash.includes("universe=qotd") ||
              window.location.pathname.includes("qotd") ||
              (document.querySelector(".gameStatusLabel, .room-title, .gameView h1, .gameView h2")?.textContent?.toLowerCase().includes("quote of the day") ?? false);

            const isPractice =
              window.location.search.includes("universe=practice") ||
              window.location.hash.includes("universe=practice") ||
              window.location.pathname.includes("practice") ||
              (document.querySelector(".gameStatusLabel, .room-title, .gameView h1, .gameView h2")?.textContent?.toLowerCase().includes("practice") ?? false);

            const mode = isQotd ? "qotd" : isPractice ? "practice" : "multiplayer";

            const race: ExtensionRace = {
              id: numId,
              textId: this.currentTextId,
              wpm: Math.round(wpm * 10) / 10,
              accuracy: Math.round(acc * 10) / 10,
              points: undefined,
              rank: 1,
              racers: 5,
              timestamp: now,
              dateStr: formatDisplayDate(now),
              mode,
            };

            this.events.onRaceCompleted(race);
          }
        }
      }
    };

    this.observer = new MutationObserver(() => checkDOM());
    this.observer.observe(document.body, { childList: true, subtree: true });

    // Immediate check
    checkDOM();
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash);
  }

  public disconnect(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
