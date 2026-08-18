const PORT = 1385;
const API_BASE = 'https://data.typeracer.com/api';

function getAuthHeaders(apiUsername?: string, apiKey?: string): Record<string, string> {
  const username = apiUsername || process.env.TR_API_USERNAME;
  const key = apiKey || process.env.TR_API_KEY;
  if (username && key) {
    const encoded = Buffer.from(`${username}:${key}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  return {};
}

async function fetchFromTR(path: string, apiUsername?: string, apiKey?: string) {
  try {
    const headers = getAuthHeaders(apiUsername, apiKey);
    const res = await fetch(`${API_BASE}${path}`, { headers });
    if (!res.ok) return { success: false, status: res.status, error: `API error: ${res.status}` };
    const json = await res.json();
    return { success: true, status: res.status, payload: json, data: json.data !== undefined ? json.data : json };
  } catch (err: any) {
    return { success: false, status: 500, error: err.message };
  }
}

async function scrapeProfile(username: string) {
  try {
    const res = await fetch(`https://data.typeracer.com/pit/profile?user=${username}`);
    const html = await res.text();

    const stats: any = { totalRaces: 0, avgWpm: null, bestWpm: null, typistLevel: null };

    // Strategy: find each Stat__Top value paired with its Stat__Btm label.
    // TypeRacer's HTML has a malformed closing tag on the Races stat (<span> instead of </span>)
    // so we use a two-pass approach: collect all stat pairs then match by label.
    const statPairs: { value: string; label: string }[] = [];
    const statBlockRe = /Stat__Top">([\s\S]*?)<\/span>[\s\S]*?Stat__Btm">([\s\S]*?)<(?:\/span|span)/gi;
    let m;
    while ((m = statBlockRe.exec(html)) !== null) {
      statPairs.push({ value: m[1].trim(), label: m[2].trim() });
    }

    for (const { value, label } of statPairs) {
      const lbl = label.toLowerCase();
      if (lbl.includes('full avg')) {
        const wpm = value.match(/([\d.]+)/);
        if (wpm) stats.avgWpm = parseFloat(wpm[1]);
      } else if (lbl.includes('best race')) {
        const wpm = value.match(/([\d.]+)/);
        if (wpm) stats.bestWpm = parseFloat(wpm[1]);
      } else if (lbl === 'races') {
        stats.totalRaces = parseInt(value.replace(/,/g, ''), 10) || 0;
      } else if (lbl.includes('exp level')) {
        stats.typistLevel = value.replace(/\s+/g, ' ').trim() || null;
      }
    }

    // Scrape "Racing Since" date from About block for joinedAt
    let joinedAt: string | null = null;
    const joinMatch = html.match(/Racing Since:[\s\S]*?<span>([^<]+)<\/span>/);
    if (joinMatch) {
      const d = new Date(joinMatch[1].trim());
      if (!isNaN(d.getTime())) joinedAt = d.toISOString();
    }

    const nameMatch = html.match(/<title>([^(<]+)\s*\(/);
    const name = nameMatch ? nameMatch[1].trim() : username;

    const premium = html.includes('Plan__Premium') && !html.includes('Plan__Basic');
    const badges = [...new Set([...html.matchAll(/data-badge="([^"]+)"/g)].map((m) => m[1]))];

    return { name, stats, premium, badges, joinedAt };
  } catch {
    return null;
  }
}

async function scrapeHistoryPages(username: string, oldestApiDateStr?: string) {
  const scrapedRaces: any[] = [];
  const dates: string[] = [];

  let curr = oldestApiDateStr ? new Date(oldestApiDateStr) : new Date("2026-05-31");
  const stopDate = new Date("2024-01-01");

  while (curr >= stopDate) {
    dates.push(curr.toISOString().split("T")[0]);
    curr.setDate(curr.getDate() - 10);
  }

  const chunkSize = 6;
  for (let i = 0; i < dates.length; i += chunkSize) {
    const chunk = dates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (dateStr) => {
        try {
          const res = await fetch(
            `https://data.typeracer.com/pit/race_history?user=${username}&n=100&startDate=${dateStr}`,
            {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              },
            }
          );
          if (!res.ok) return;
          const html = await res.text();
          const rows = [...html.matchAll(/<div class="Scores__Table__Row">([\s\S]*?)<\/div>\s*<\/div>/g)];
          for (const r of rows) {
            const content = r[1];
            const numMatch = content.match(/id="\|tr:[^|]+\|(\d+)"/i) || content.match(/href="\/pit\/result\?id=[^"]*?\|(\d+)"/i);
            const wpmMatch = content.match(/(\d+)\s*WPM/i);
            const accMatch = content.match(/([\d.]+)%/);
            const ptsMatch = content.match(/profileTableHeaderAvg">[\s\S]*?(\d+)/i);
            const dateMatch = content.match(/profileTableHeaderDate">[\s\S]*?([A-Z][a-z]{2}\s+\d+,\s+\d{4})/i);
            const rankMatch = content.match(/profileTableHeaderPoints">[\s\S]*?(\d+)\/(\d+)/i);
            const modeMatch = content.match(/profileTableHeaderRaces">[\s\S]*?([A-Za-z0-9\s]+)/i);

            if (wpmMatch && dateMatch) {
              const raceNum = numMatch ? parseInt(numMatch[1]) : undefined;
              const wpm = parseFloat(wpmMatch[1]);
              const acc = accMatch ? parseFloat(accMatch[1]) / 100 : 0.98;
              const pts = ptsMatch ? parseFloat(ptsMatch[1]) : 0;
              const rank = rankMatch ? parseInt(rankMatch[1]) : 1;
              const nr = rankMatch ? parseInt(rankMatch[2]) : 5;
              const dateStrParsed = new Date(dateMatch[1]).toISOString();
              let mode = modeMatch ? modeMatch[1].trim() : (nr <= 1 ? "practice" : "multiplayer");
              if (mode.toLowerCase().includes("quote") || mode.toLowerCase().includes("qotd")) {
                mode = "qotd";
              }

              scrapedRaces.push({
                rid: `scraped_${raceNum || Math.random()}`,
                t: dateStrParsed,
                wpm,
                acc,
                pts,
                r: rank,
                nr,
                tid: 0,
                mode,
                rn: raceNum,
              });
            }
          }
        } catch {
          // continue
        }
      })
    );
  }
  return scrapedRaces;
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (url.pathname === '/api/user-stats' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { username, apiKey, apiUsername } = body;

        if (!username) {
          return Response.json({ error: 'Username is required' }, { status: 400 });
        }

        const effectiveUsername = apiUsername || username || process.env.TR_API_USERNAME;
        const effectiveKey = apiKey || process.env.TR_API_KEY;
        const hasAuth = !!(effectiveUsername && effectiveKey);

        if (!hasAuth) {
          const profile = await scrapeProfile(username);
          if (!profile) {
            return Response.json({ error: 'User not found. Please check the username.' }, { status: 404 });
          }
          return Response.json({
            username,
            name: profile.name,
            joinedAt: profile.joinedAt ?? null,
            premium: profile.premium,
            badges: profile.badges,
            stats: profile.stats,
            races: [],
            qotdDone: false,
            note: 'Enter your API key for full historical data',
          });
        }

        const limit = body.limit || 1000;
        const [racerRes, statsRes, batch1Res, scrapeData] = await Promise.all([
          fetchFromTR(`/v1/racers/${username}?universe=play`, effectiveUsername, effectiveKey),
          fetchFromTR(`/v1/racers/${username}/stats?universe=play`, effectiveUsername, effectiveKey),
          fetchFromTR(`/v1/racers/${username}/races?universe=play&n=${limit}`, effectiveUsername, effectiveKey),
          scrapeProfile(username),
        ]);

        if (!racerRes.success && (racerRes.status === 401 || racerRes.error?.includes('401'))) {
          if (apiKey || apiUsername) {
            return Response.json({ error: 'Invalid API key. Please check your credentials.' }, { status: 401 });
          }
          const profile = scrapeData || (await scrapeProfile(username));
          if (!profile) {
            return Response.json({ error: 'User not found. Please check the username.' }, { status: 404 });
          }
          return Response.json({
            username,
            name: profile.name,
            joinedAt: profile.joinedAt ?? null,
            premium: profile.premium,
            badges: profile.badges,
            stats: profile.stats,
            races: [],
            qotdDone: false,
            note: 'Enter your API key for full historical data',
          });
        }

        const racer = racerRes.data || {};
        const statsArray = Array.isArray(statsRes.data) ? statsRes.data : Array.isArray(racer.stats) ? [racer.stats] : racer.stats ? [racer.stats] : [];
        const apiStats = statsArray.find((s: any) => s.universe === 'play') || statsArray[0] || racer.stats || null;

        // Fetch latest races via API, then scrape remaining pages if API is capped at 1000
        let rawRaces: any[] = Array.isArray(batch1Res.data) ? batch1Res.data : [];
        if (rawRaces.length >= 1000 && limit >= 1000) {
          const oldestApiRace = rawRaces[rawRaces.length - 1];
          const oldestDate = oldestApiRace?.t ? new Date(typeof oldestApiRace.t === 'number' ? oldestApiRace.t * 1000 : oldestApiRace.t).toISOString() : undefined;
          const extraRaces = await scrapeHistoryPages(username, oldestDate);
          if (extraRaces.length > 0) {
            const existingIds = new Set(rawRaces.map((r: any) => r.rid || r.rn));
            for (const er of extraRaces) {
              if (!existingIds.has(er.rid) && !existingIds.has(er.rn)) {
                rawRaces.push(er);
              }
            }
          }
        }

        const races = rawRaces
          .filter((r: any) => r.wpm != null && r.wpm > 0)
          .map((r: any) => ({
            id: r.rid,
            date: r.t,
            speed: r.wpm,
            accuracy: r.acc != null ? r.acc * 100 : 0,
            points: r.pts,
            rank: r.r,
            totalRacers: r.nr,
            textId: r.tid,
            won: r.r === 1,
            mode: r.mode || r.gn || r.game_mode || (r.nr <= 1 ? 'practice' : 'multiplayer'),
          }));

        let totalRaces = apiStats?.total_races ?? apiStats?.totalRaces ?? apiStats?.numRaces ?? apiStats?.num_races ?? null;
        let totalWins = apiStats?.total_wins ?? apiStats?.totalWins ?? apiStats?.num_wins ?? apiStats?.numWins ?? null;
        const statsPoints = apiStats?.points ?? null;
        let avgWpm = apiStats?.avg_wpm ?? apiStats?.avgWpm ?? apiStats?.wpm_average ?? apiStats?.averageWpm ?? null;
        let bestWpm = apiStats?.best_wpm ?? apiStats?.bestWpm ?? apiStats?.wpm_best ?? apiStats?.bestRaceWpm ?? null;
        const certWpm = apiStats?.cert_wpm ?? apiStats?.certWpm ?? null;

        // Fallback: fill missing stats from scrape, then from fetched races
        if (scrapeData?.stats) {
          const sc = scrapeData.stats;
          if ((totalRaces == null || totalRaces === 0) && sc.totalRaces > 0) totalRaces = sc.totalRaces;
          if ((avgWpm == null || avgWpm === 0) && sc.avgWpm != null) avgWpm = sc.avgWpm;
          if ((bestWpm == null || bestWpm === 0) && sc.bestWpm != null) bestWpm = sc.bestWpm;
        }
        if (races.length > 0) {
          if (totalRaces == null || totalRaces === 0) totalRaces = races.length;
          if (avgWpm == null || avgWpm === 0) {
            const sum = races.reduce((s: number, r: any) => s + (r.speed || 0), 0);
            avgWpm = parseFloat((sum / races.length).toFixed(2));
          }
          if (bestWpm == null || bestWpm === 0) {
            bestWpm = Math.max(...races.map((r: any) => r.speed || 0));
          }
          if (totalWins == null) {
            totalWins = races.filter((r: any) => r.won).length;
          }
        }

        // QOTD Status: Check if a QOTD race or competition result occurred AFTER current QOTD day start (00:00 UTC)
        const now = new Date();
        const today00UTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

        let qotdDone = races.some((r: any) => {
          if (!r.date) return false;
          const mode = (r.mode || '').toLowerCase();
          const rTime = new Date(r.date.replace(' ', 'T')).getTime();
          return (mode.includes('qotd') || mode === 'daily' || mode === 'competition') && rTime >= today00UTC;
        });

        return Response.json({
          username,
          name: racer?.name || scrapeData?.name || username,
          joinedAt: racer?.joined_at || null,
          premium: racer?.premium ?? scrapeData?.premium ?? false,
          badges: racer?.badges || scrapeData?.badges || [],
          stats: {
            totalRaces: totalRaces ?? races.length ?? 0,
            totalWins: totalWins ?? races.filter((r: any) => r.won).length ?? 0,
            points: statsPoints,
            avgWpm,
            bestWpm,
            certWpm,
            typistLevel: null,
          },
          races,
          qotdDone,
        });
      } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Bun API Server running at http://localhost:${PORT}`);
