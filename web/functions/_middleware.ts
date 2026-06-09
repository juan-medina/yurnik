// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

import { buildOgTags, type OgPage } from "../src/lib/og";

const CRAWLER_UA = /Discordbot|WhatsApp|Twitterbot|LinkedInBot|Slackbot-LinkExpanding|facebookexternalhit|Telegrambot|iframely|Googlebot/i;

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  API_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const ua = request.headers.get("user-agent") ?? "";
    if (!CRAWLER_UA.test(ua)) {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const apiUrl = env.API_URL ?? "https://api.yurnik.gg";

    const page = await resolvePage(url.pathname, apiUrl);
    const tags = buildOgTags(page, url.origin);

    return new Response(renderOgHtml(tags, url.href), {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });
  },
};

async function resolvePage(pathname: string, apiUrl: string): Promise<OgPage> {
  const playerMatch = pathname.match(/^\/player\/([^/]+)$/);
  if (playerMatch) {
    try {
      const resp = await fetch(`${apiUrl}/api/players/${playerMatch[1]}/profile`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          name: string; handle: string; avatar_url?: string; bio?: string;
        };
        return { type: "player", name: data.name, handle: data.handle, avatarUrl: data.avatar_url, bio: data.bio };
      }
    } catch { /* fall through */ }
    return { type: "site" };
  }

  const gameMatch = pathname.match(/^\/game\/(\d+)$/);
  if (gameMatch) {
    try {
      const resp = await fetch(`${apiUrl}/api/games/${gameMatch[1]}`);
      if (resp.ok) {
        const data = (await resp.json()) as { name: string; cover_url?: string; summary?: string };
        return { type: "game", name: data.name, coverUrl: data.cover_url, summary: data.summary };
      }
    } catch { /* fall through */ }
    return { type: "site" };
  }

  const journeyMatch = pathname.match(/^\/journey\/([^/]+)$/);
  if (journeyMatch) {
    try {
      const resp = await fetch(`${apiUrl}/api/journeys/${journeyMatch[1]}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          game: string; cover_url?: string; log?: string; player: { name: string };
        };
        return { type: "journey", playerName: data.player.name, gameName: data.game, coverUrl: data.cover_url, log: data.log };
      }
    } catch { /* fall through */ }
    return { type: "site" };
  }

  return { type: "site" };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderOgHtml(tags: { title: string; description: string; imageUrl: string }, canonicalUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(tags.title)}</title>
<meta name="description" content="${esc(tags.description)}"/>
<meta property="og:site_name" content="Yurnik"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${esc(canonicalUrl)}"/>
<meta property="og:title" content="${esc(tags.title)}"/>
<meta property="og:description" content="${esc(tags.description)}"/>
<meta property="og:image" content="${esc(tags.imageUrl)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(tags.title)}"/>
<meta name="twitter:description" content="${esc(tags.description)}"/>
<meta name="twitter:image" content="${esc(tags.imageUrl)}"/>
</head>
<body></body>
</html>`;
}
