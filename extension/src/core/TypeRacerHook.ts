import type { ExtensionRace } from "../types";

export interface TypeRacerHookEvents {
  onQuoteLoaded: (textId: number, quoteText: string) => void;
  onRaceCompleted: (race: ExtensionRace) => void;
}

export class TypeRacerHook {
  private events: TypeRacerHookEvents;
  private currentTextId: number = 0;
  private currentQuoteText: string = "";
  private observer: MutationObserver | null = null;
  private isRaceInProgress = false;

  constructor(events: TypeRacerHookEvents) {
    this.events = events;
    this.initNetworkInterceptor();
    this.initDOMObserver();
  }

  private initNetworkInterceptor(): void {
    // Intercept fetch responses
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
        // ignore JSON parse errors on non-json requests
      }
      return response;
    };

    // Intercept XHR responses
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
        const race: ExtensionRace = {
          id: String(item.rid),
          date: item.t || new Date().toISOString(),
          speed: Math.round(Number(item.wpm)),
          accuracy: item.acc != null ? Number((item.acc * (item.acc <= 1 ? 100 : 1)).toFixed(1)) : 100,
          points: item.pts != null ? Number(item.pts) : null,
          rank: item.r || 1,
          totalRacers: item.nr || 1,
          textId: item.tid || this.currentTextId || 0,
          won: item.r === 1,
          mode: item.gn || item.mode || "multiplayer",
          quoteText: this.currentQuoteText,
        };
        this.events.onRaceCompleted(race);
      }
    }
  }

  private initDOMObserver(): void {
    const checkDOM = () => {
      // 1. Detect quote text in game box
      const textContainer = document.querySelector(".gameView .textPane, .gameView .unhandled, .gameView [data-qa='quote']");
      if (textContainer && textContainer.textContent) {
        const fullText = textContainer.textContent.trim();
        if (fullText && fullText !== this.currentQuoteText) {
          this.currentQuoteText = fullText;
          this.isRaceInProgress = true;

          // Attempt to locate textId from info links if available
          let tid = 0;
          const infoLink = document.querySelector("a[href*='text_info?id=']");
          if (infoLink) {
            const match = infoLink.getAttribute("href")?.match(/id=(\d+)/);
            if (match) tid = parseInt(match[1], 10);
          }
          if (!tid) {
            // Simple deterministic string hash for quote identification
            tid = this.hashString(fullText);
          }
          this.currentTextId = tid;
          this.events.onQuoteLoaded(tid, fullText);
        }
      }

      // 2. Detect race end popup/summary if network intercept didn't trigger
      const rankPanel = document.querySelector(".rankPanel, .popup .wpmScore, .gameView .rank");
      if (rankPanel && this.isRaceInProgress) {
        const wpmEl = document.querySelector(".wpmScore, .rankPanel .wpm, .popup span:contains('wpm')");
        const wpmMatch = document.body.innerText.match(/(\d+)\s*wpm/i);
        const accMatch = document.body.innerText.match(/(\d+(?:\.\d+)?)\s*%\s*accuracy/i);

        if (wpmMatch) {
          const wpm = parseInt(wpmMatch[1], 10);
          const acc = accMatch ? parseFloat(accMatch[1]) : 100;
          this.isRaceInProgress = false;

          const race: ExtensionRace = {
            id: "race_" + Date.now(),
            date: new Date().toISOString(),
            speed: wpm,
            accuracy: acc,
            points: null,
            rank: 1,
            totalRacers: 1,
            textId: this.currentTextId,
            won: true,
            mode: "multiplayer",
            quoteText: this.currentQuoteText,
          };
          this.events.onRaceCompleted(race);
        }
      }
    };

    this.observer = new MutationObserver(() => checkDOM());
    this.observer.observe(document.body, { childList: true, subtree: true });
    
    // Also run immediate check
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
