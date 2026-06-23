// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT

// One link-preview/embed bot per line, curated from
// https://github.com/monperrus/crawler-user-agents (plus "cardyb" for
// Bluesky, which that list is missing). Where a platform ships several
// near-identical bots (e.g. Meta's "meta-external{ads,agent,fetcher}"),
// a single shared substring covers all of them - add or trim a line here
// as platforms come and go.
const BOT_PATTERNS = [
  "facebook",
  "Facebot",
  "Twitter",
  "Discordbot",
  "TelegramBot",
  "WhatsApp",
  "slack",
  "SkypeUriPreview",
  "LinkedInBot",
  "redditbot",
  "vkShare",
  "Disqus",
  "Yahoo Link Preview",
  "BingPreview",
  "Google Web Preview",
  "Mastodon",
  "Friendica",
  "Lemmy",
  "Chirp|gotosocial",
  "snap",
  "bluesky",
  "cardyb",
  "meta-external",
  "Embedly",
  "Iframely",
  "LinkArchiver",
  "GroupMeBot",
  "Tumblr",
  "Notion",
  "BufferLinkPreviewBot",
  "EvernoteRichLinkBot",
  "ClickUpLinkUnfurler",
  "Mediumbot-MetaTagFetcher",
  "Chatwork LinkPreview",
  "DingTalkBot-LinkService",
  "Discourse Forum Onebox",
  "ArenaUnfurlBot",
];

export const botUserAgentRegex = new RegExp(BOT_PATTERNS.join("|"), "i");
