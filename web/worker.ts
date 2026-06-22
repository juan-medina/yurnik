declare const HTMLRewriter: any;

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  VITE_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get("user-agent") || "";
    const botRegex = /bot|crawl|spider|slurp|facebook|twitter|discord|whatsapp|telegram|slack/i;
    const isBot = botRegex.test(userAgent);

    const getAssetResponse = async () => {
      // SPA fallback serves index.html content directly for unmatched paths,
      // unlike an explicit /index.html request which Cloudflare 307-redirects to /
      return env.ASSETS.fetch(request);
    };

    // 1. Journey Detail (/journey/:id)
    const journeyMatch = url.pathname.match(/^\/journey\/([^/]+)$/);
    if (journeyMatch && isBot) {
      const id = journeyMatch[1];
      const apiUrl = env.VITE_API_URL || "https://api.yurnik.social";
      try {
        const apiRes = await fetch(`${apiUrl}/api/journeys/${id}`);
        if (apiRes.ok) {
          const journey = await apiRes.json() as any;
          const title = `${journey.player.name} played ${journey.game}`;
          const description = journey.log || `A gaming journey of ${journey.game} on Yurnik.`;
          const imageUrl = journey.cover_url || `${url.origin}/logo.png`;

          const assetRes = await getAssetResponse();
          return new HTMLRewriter()
            .on('meta[property="og:title"]', { element(el: any) { el.setAttribute('content', title); } })
            .on('meta[name="twitter:title"]', { element(el: any) { el.setAttribute('content', title); } })
            .on('meta[property="og:description"]', { element(el: any) { el.setAttribute('content', description); } })
            .on('meta[name="twitter:description"]', { element(el: any) { el.setAttribute('content', description); } })
            .on('meta[property="og:image"]', { element(el: any) { el.setAttribute('content', imageUrl); } })
            .on('meta[name="twitter:image"]', { element(el: any) { el.setAttribute('content', imageUrl); } })
            .transform(assetRes);
        }
      } catch (e) {
        console.error("Worker journey fetch error:", e);
      }
    }

    // 2. Game Detail (/game/:igdbId)
    const gameMatch = url.pathname.match(/^\/game\/([^/]+)$/);
    if (gameMatch && isBot) {
      const igdbId = gameMatch[1];
      const apiUrl = env.VITE_API_URL || "https://api.yurnik.social";
      try {
        const apiRes = await fetch(`${apiUrl}/api/games/${igdbId}`);
        if (apiRes.ok) {
          const game = await apiRes.json() as any;
          const title = `${game.name} on Yurnik`;
          const description = game.summary || `Browse game activity and players on Yurnik.`;
          const imageUrl = game.cover_url || `${url.origin}/logo.png`;

          const assetRes = await getAssetResponse();
          return new HTMLRewriter()
            .on('meta[property="og:title"]', { element(el: any) { el.setAttribute('content', title); } })
            .on('meta[name="twitter:title"]', { element(el: any) { el.setAttribute('content', title); } })
            .on('meta[property="og:description"]', { element(el: any) { el.setAttribute('content', description); } })
            .on('meta[name="twitter:description"]', { element(el: any) { el.setAttribute('content', description); } })
            .on('meta[property="og:image"]', { element(el: any) { el.setAttribute('content', imageUrl); } })
            .on('meta[name="twitter:image"]', { element(el: any) { el.setAttribute('content', imageUrl); } })
            .transform(assetRes);
        }
      } catch (e) {
        console.error("Worker game fetch error:", e);
      }
    }

    // 3. Player Profile (/player/:handle)
    const playerMatch = url.pathname.match(/^\/player\/([^/]+)$/);
    if (playerMatch && isBot) {
      const handle = playerMatch[1];
      const apiUrl = env.VITE_API_URL || "https://api.yurnik.social";
      try {
        const apiRes = await fetch(`${apiUrl}/api/players/${handle}`);
        if (apiRes.ok) {
          const player = await apiRes.json() as any;
          const title = `${player.name} (@${player.handle}) on Yurnik`;
          const description = player.bio || `Check out ${player.name}'s gaming journeys on Yurnik.`;
          const imageUrl = player.avatar_url || `${url.origin}/logo.png`;

          const assetRes = await getAssetResponse();
          return new HTMLRewriter()
            .on('meta[property="og:title"]', { element(el: any) { el.setAttribute('content', title); } })
            .on('meta[name="twitter:title"]', { element(el: any) { el.setAttribute('content', title); } })
            .on('meta[property="og:description"]', { element(el: any) { el.setAttribute('content', description); } })
            .on('meta[name="twitter:description"]', { element(el: any) { el.setAttribute('content', description); } })
            .on('meta[property="og:image"]', { element(el: any) { el.setAttribute('content', imageUrl); } })
            .on('meta[name="twitter:image"]', { element(el: any) { el.setAttribute('content', imageUrl); } })
            .transform(assetRes);
        }
      } catch (e) {
        console.error("Worker player fetch error:", e);
      }
    }

    // Default: serve static asset
    return env.ASSETS.fetch(request);
  }
};
