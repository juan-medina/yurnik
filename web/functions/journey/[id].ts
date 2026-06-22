interface Env {
  VITE_API_URL?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;
  const id = params.id as string;
  const response = await context.next();

  // Detect if request is from a crawler bot
  const userAgent = request.headers.get("user-agent") || "";
  const botRegex = /bot|crawl|spider|slurp|facebook|twitter|discord|whatsapp|telegram|slack/i;
  if (!botRegex.test(userAgent)) {
    return response;
  }

  const apiUrl = env.VITE_API_URL || "https://api.yurnik.social";
  try {
    const apiRes = await fetch(`${apiUrl}/api/journeys/${id}`);
    if (!apiRes.ok) {
      return response;
    }

    const journey = await apiRes.json() as any;
    const title = `${journey.player.name} played ${journey.game}`;
    const description = journey.log || `A gaming journey of ${journey.game} on Yurnik.`;
    const imageUrl = journey.cover_url || `${new URL(request.url).origin}/logo.png`;

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
