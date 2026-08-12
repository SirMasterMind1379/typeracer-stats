import type { ExtensionRace } from "../types";

export interface TypeRacerHookEvents {
  onQuoteLoaded: (textId: number, quoteText: string) => void;
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
  private lastHandledRaceId = "";
  private lastHandledRaceTime = 0;

  constructor(events: TypeRacerHookEvents) {
    this.events = events;
    this.initNetworkInterceptor();
    this.initDOMObserver();
  }

  public detectUsername(): string {
    // 1. Check profile link in header/DOM
    const profileLinks = document.querySelectorAll("a[href*='/pit/profile?user='], a[href*='/pit/racer?user=']");
    for (const link of profileLinks) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/user=([a-zA-Z0-9_]+)/);
      if (match && match[1]) return match[1];
    }

    // 2. Check racer name DOM element
    const userEl = document.querySelector(".racerProfileLink, .userName, .profileNav .name, .racerName");
    if (userEl && userEl.textContent) {
      const name = userEl.textContent.trim();
      if (name && !name.includes(" ") && name.length >= 2) return name;
    }

    // 3. Check Cookie
    const cookieMatch = document.cookie.match(/(?:^|; )tr_username=([^;]*)/);
    if (cookieMatch && cookieMatch[1]) return decodeURIComponent(cookieMatch[1]);

    return "";
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
        // ignore
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
        const raceId = String(item.rid);
        if (this.lastHandledRaceId === raceId) continue;
        this.lastHandledRaceId = raceId;

        const race: ExtensionRace = {
          id: raceId,
          date: item.t ? (typeof item.t === 'number' ? new Date(item.t * 1000).toISOString() : String(item.t)) : new Date().toISOString(),
          speed: Math.round(Number(item.wpm)),
          accuracy: item.acc != null ? Number((item.acc * (item.acc <= 1 ? 100 : 1)).toFixed(1)) : 100,
          points: item.pts != null ? Number(item.pts) : null,
          rank: item.r || 1,
          totalRacers: item.nr || 5,
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
      // 0. Check Username
      const user = this.detectUsername();
      if (user && user !== this.detectedUsername) {
        this.detectedUsername = user;
        if (this.events.onUsernameDetected) {
          this.events.onUsernameDetected(user);
        }
      }

      // 1. Detect quote text & exact textId in game box
      const textContainer = document.querySelector(".gameView .textPane, .gameView .unhandled, .gameView [data-qa='quote']");
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

      // 2. Detect Text ID if link loads after initial render
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

      // 3. Detect Race Completion Link or Rank Panel in DOM
      const resultLink = document.querySelector("a[href*='/pit/result?id=']");
      const rankPanel = document.querySelector(".rankPanel, .tblScore, .popup .wpmScore, .gameView .rank");

      if ((resultLink || rankPanel) && (this.isRaceInProgress || Date.now() - this.lastHandledRaceTime > 5000)) {
        let raceId = "";
        if (resultLink) {
          const href = resultLink.getAttribute("href") || "";
          const match = href.match(/id=([^&]+)/);
          if (match) raceId = match[1];
        }

        if (!raceId) {
          raceId = `race_${Date.now()}`;
        }

        if (this.lastHandledRaceId !== raceId) {
          const wpmMatch = document.body.innerText.match(/(\d+)\s*wpm/i);
          const accMatch = document.body.innerText.match(/(\d+(?:\.\d+)?)\s*%\s*accuracy/i);

          if (wpmMatch) {
            const wpm = parseInt(wpmMatch[1], 10);
            const acc = accMatch ? parseFloat(accMatch[1]) : 100;

            this.isRaceInProgress = false;
            this.lastHandledRaceId = raceId;
            this.lastHandledRaceTime = Date.now();

            const race: ExtensionRace = {
              id: raceId,
              date: new Date().toISOString(),
              speed: wpm,
              accuracy: acc,
              points: null,
              rank: 1,
              totalRacers: 5,
              textId: this.currentTextId,
              won: true,
              mode: "multiplayer",
              quoteText: this.currentQuoteText,
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
