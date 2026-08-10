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

    const avgMatch = html.match(/Stat__Top">([\d.]+)\s*WPM<\/span>(?:(?!Stat__Top)[\s\S])*?Stat__Btm">Full Avg\./i);
    if (avgMatch) stats.avgWpm = parseFloat(avgMatch[1]);

    const bestMatch = html.match(/Stat__Top">([\d.]+)\s*WPM<\/span>(?:(?!Stat__Top)[\s\S])*?Stat__Btm">Best Race/i);
    if (bestMatch) stats.bestWpm = parseFloat(bestMatch[1]);

    const racesMatch = html.match(/Stat__Top">(\d+)<\/span>(?:(?!Stat__Top)[\s\S])*?Stat__Btm">Races/i);
    if (racesMatch) stats.totalRaces = parseInt(racesMatch[1]);

    const typistMatch = html.match(/Stat__Top">([^<]+)<\/span>(?:(?!Stat__Top)[\s\S])*?Stat__Btm">Exp Level/i);
    if (typistMatch) stats.typistLevel = typistMatch[1].trim();

    const nameMatch = html.match(/<title>([^(<]+)\s*\(/);
    const name = nameMatch ? nameMatch[1].trim() : username;

    const premium = html.includes('Plan__Premium') && !html.includes('Plan__Basic');
    const badges = [...new Set([...html.matchAll(/data-badge="([^"]+)"/g)].map((m) => m[1]))];

    return { name, stats, premium, badges };
  } catch {
    return null;
  }
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
            joinedAt: null,
            premium: profile.premium,
            badges: profile.badges,
            stats: profile.stats,
            races: [],
            qotdDone: false,
            note: 'Enter your API key for full historical data',
          });
        }

        const [racerRes, statsRes, racesRes, scrapeData] = await Promise.all([
          fetchFromTR(`/v1/racers/${username}?universe=play`, effectiveUsername, effectiveKey),
          fetchFromTR(`/v1/racers/${username}/stats?universe=play`, effectiveUsername, effectiveKey),
          fetchFromTR(`/v1/racers/${username}/races?universe=play&n=500`, effectiveUsername, effectiveKey),
          scrapeProfile(username),
        ]);

        if (!racerRes.success && (racerRes.status === 401 || racerRes.error?.includes('401'))) {
          if (apiKey || apiUsername) {
            return Response.json({ error: 'Invalid API key. Please check your credentials.' }, { status: 401 });
          }
          const profile = await scrapeProfile(username);
          if (!profile) {
            return Response.json({ error: 'User not found. Please check the username.' }, { status: 404 });
          }
          return Response.json({
            username,
            name: profile.name,
            joinedAt: null,
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
        const rawRaces = Array.isArray(racesRes.data) ? racesRes.data : [];

        const races = rawRaces
          .filter((r: any) => r.wpm != null)
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
            mode: r.mode || r.gn || r.game_mode || undefined,
          }));

        console.log('[debug] statsRes.data:', JSON.stringify(statsRes.data));
        console.log('[debug] racerRes.data:', JSON.stringify(racerRes.data));
        console.log('[debug] apiStats:', JSON.stringify(apiStats));
        console.log('[debug] sample race[0]:', JSON.stringify(rawRaces[0]));

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

        let qotdDone = false;
        const today = new Date().toISOString().slice(0, 10);
        try {
          const compRes = await fetchFromTR(`/v2/competitions?universe=play&date=${today}`, effectiveUsername, effectiveKey);
          const competitions = Array.isArray(compRes.data) ? compRes.data : [];
          if (competitions.length > 0) {
            const daily = competitions[0];
            const resultsRes = await fetchFromTR(`/v2/competitions/results?uid=${daily.uid}`, effectiveUsername, effectiveKey);
            const results = Array.isArray(resultsRes.data) ? resultsRes.data : [];
            qotdDone = results.some((r: any) => r.username === username);
          }
        } catch {
          // fall through
        }

        if (!qotdDone) {
          qotdDone = races.some((r: any) => {
            if (!r.date) return false;
            const mode = (r.mode || r.gn || r.game_mode || '').toLowerCase();
            return r.date.slice(0, 10) === today && (mode.includes('qotd') || mode === 'daily' || mode === 'competition');
          });
        }

        return Response.json({
          username,
          name: racer?.name || scrapeData?.name || username,
          joinedAt: racer?.joined_at || null,
          premium: racer?.premium ?? scrapeData?.premium ?? false,
          badges: racer?.badges || scrapeData?.badges || [],
          stats: {
            totalRaces,
            totalWins,
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
