import { NextResponse } from 'next/server';

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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getAuthHeaders(apiUsername, apiKey),
  });
  if (!res.ok) return { success: false, error: `API error: ${res.status}` };
  return res.json();
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, apiKey, apiUsername } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const hasAuth = !!(apiUsername || process.env.TR_API_USERNAME) && !!(apiKey || process.env.TR_API_KEY);

    if (!hasAuth) {
      const profile = await scrapeProfile(username);
      if (!profile) {
        return NextResponse.json({ error: 'User not found. Please check the username.' }, { status: 404 });
      }
      return NextResponse.json({
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

    const effectiveUsername = apiUsername || process.env.TR_API_USERNAME!;
    const effectiveKey = apiKey || process.env.TR_API_KEY!;
    const userProvidedKey = !!(apiUsername || apiKey);

    const [racerRes, statsRes, racesRes] = await Promise.all([
      fetchFromTR(`/v1/racers/${username}?universe=play`, effectiveUsername, effectiveKey),
      fetchFromTR(`/v1/racers/${username}/stats?universe=play`, effectiveUsername, effectiveKey),
      fetchFromTR(`/v1/racers/${username}/races?universe=play&n=500`, effectiveUsername, effectiveKey),
    ]);

    if (!racerRes.success && racerRes.error?.includes('401')) {
      if (userProvidedKey) {
        return NextResponse.json({ error: 'Invalid API key. Please check your credentials.' }, { status: 401 });
      }
      // env var key is invalid — fall back to scraping
      const profile = await scrapeProfile(username);
      if (!profile) {
        return NextResponse.json({ error: 'User not found. Please check the username.' }, { status: 404 });
      }
      return NextResponse.json({
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

    const racer = racerRes.data || racerRes.success;
    const statsArray = Array.isArray(statsRes.data) ? statsRes.data : [];
    const apiStats = statsArray.find((s: any) => s.universe === 'play') || statsArray[0] || null;
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

    // Defensive stats parsing — handle different field name conventions
    const totalRaces = apiStats?.total_races ?? apiStats?.totalRaces ?? races.length ?? 0;
    const totalWins = apiStats?.total_wins ?? apiStats?.totalWins;
    const statsPoints = apiStats?.points ?? null;
    const avgWpm = apiStats?.avg_wpm ?? apiStats?.avgWpm;
    const bestWpm = apiStats?.best_wpm ?? apiStats?.bestWpm;
    const certWpm = apiStats?.cert_wpm ?? apiStats?.certWpm ?? null;

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
      // fall through to the race-based check below
    }

    // If competitions didn't confirm QOTD, check if user raced today
    if (!qotdDone) {
      qotdDone = races.some((r: any) => r.date && r.date.slice(0, 10) === today);
    }

    return NextResponse.json({
      username,
      name: racer?.name || username,
      joinedAt: racer?.joined_at || null,
      premium: racer?.premium || false,
      badges: racer?.badges || [],
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}