interface Env {
  VITE_API_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const igdbId = params.igdbId as string;
  const response = await context.next();

  // Detect if request is from a crawler bot
  const userAgent = request.headers.get("user-agent") || "";
  const botRegex = /bot|crawl|spider|slurp|facebook|twitter|discord|whatsapp|telegram|slack/i;
  if (!botRegex.test(userAgent)) {
    return response;
  }

  const apiUrl = env.VITE_API_URL || "https://api.yurnik.social";
  try {
    const apiRes = await fetch(`${apiUrl}/api/games/${igdbId}`);
    if (!apiRes.ok) {
      return response;
    }

    const game = await apiRes.json() as any;
    const title = `${game.name} on Yurnik`;
    const description = game.summary || `Browse game activity and players on Yurnik.`;
    const imageUrl = game.cover_url || `${new URL(request.url).origin}/logo.png`;

    return new HTMLRewriter()
      .on('meta[property="og:title"]', {
        element(el) { el.setAttribute('content', title); }
      })
      .on('meta[name="twitter:title"]', {
        element(el) { el.setAttribute('content', title); }
      })
      .on('meta[property="og:description"]', {
        element(el) { el.setAttribute('content', description); }
      })
      .on('meta[name="twitter:description"]', {
        element(el) { el.setAttribute('content', description); }
      })
      .on('meta[property="og:image"]', {
        element(el) { el.setAttribute('content', imageUrl); }
      })
      .on('meta[name="twitter:image"]', {
        element(el) { el.setAttribute('content', imageUrl); }
      })
      .transform(response);
  } catch (error) {
    console.error("Error generating preview metadata:", error);
    return response;
  }
};
